"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Address, AddressInput } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useAccount, usePublicClient } from "wagmi";
import {
  useScaffoldReadContract,
  useScaffoldWatchContractEvent,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";

const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

type SubjectValue = 0 | 1 | 2;

const SUBJECTS: Array<{ value: SubjectValue; label: string }> = [
  { value: 0, label: "Программирование" },
  { value: 1, label: "Английский" },
  { value: 2, label: "Математика" },
];

const SUBJECT_LABEL: Record<SubjectValue, string> = {
  0: "Программирование",
  1: "Английский",
  2: "Математика",
};

type EventEntry = {
  id: string;
  student: string;
  timestamp: string;
  subject: SubjectValue;
};

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const publicClient = usePublicClient({ chainId: targetNetwork.id });
  const [selectedSubject, setSelectedSubject] = useState<SubjectValue>(0);

  const myStatusArgs = useMemo(() => [selectedSubject, connectedAddress] as const, [selectedSubject, connectedAddress]);

  const { data: myStatus, refetch: refetchMyStatus } = useScaffoldReadContract({
    contractName: "Attendance",
    functionName: "isPresent",
    args: myStatusArgs,
    watch: true,
  });

  const [lookupAddr, setLookupAddr] = useState("");
  const lookupArgs = useMemo(
    () => [selectedSubject, isAddress(lookupAddr) ? (lookupAddr as `0x${string}`) : undefined] as const,
    [lookupAddr, selectedSubject],
  );

  const { data: lookupStatus } = useScaffoldReadContract({
    contractName: "Attendance",
    functionName: "isPresent",
    args: lookupArgs,
    watch: true,
  });

  useEffect(() => {
    if (connectedAddress && !lookupAddr) {
      setLookupAddr(connectedAddress);
    }
  }, [connectedAddress, lookupAddr]);

  const { writeContractAsync, isPending } = useScaffoldWriteContract("Attendance");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleCheckIn = async () => {
    try {
      setErrMsg(null);
      await writeContractAsync({
        functionName: "checkIn",
        args: [selectedSubject],
      });
      await refetchMyStatus?.();
    } catch (e: any) {
      setErrMsg(e?.shortMessage || e?.message || "Transaction failed");
    }
  };

  const canCheckIn = Boolean(connectedAddress) && !isPending && myStatus !== true;

  const [events, setEvents] = useState<EventEntry[]>([]);

  useScaffoldWatchContractEvent({
    contractName: "Attendance",
    eventName: "CheckedIn",
    onLogs: logs => {
      if (!publicClient) return;
      void (async () => {
        const hydrated = await Promise.all(
          logs.map(async log => {
            const block = log.blockHash ? await publicClient.getBlock({ blockHash: log.blockHash }) : undefined;
            const timestamp =
              block?.timestamp !== undefined
                ? new Date(Number(block.timestamp) * 1000).toLocaleString()
                : new Date().toLocaleString();
            return {
              id: `${log.transactionHash}-${log.logIndex}`,
              student: (log.args?.student as string) ?? "",
              subject: Number(log.args?.subject ?? 0) as SubjectValue,
              timestamp,
            };
          }),
        );
        setEvents(prev => {
          const known = new Set(prev.map(ev => ev.id));
          const unique = hydrated.filter(ev => !known.has(ev.id));
          return [...unique, ...prev];
        });
      })();
    },
  });

  const myStatusLabel = myStatus === undefined ? "..." : myStatus ? "Пришёл" : "Не отмечен";
  const lookupLabel = lookupStatus === undefined ? "--" : lookupStatus ? "Пришёл" : "Не отмечен";

  return (
    <div data-theme="emerald" className="flex items-center flex-col grow bg-base-200 py-12">
      <div className="w-full max-w-5xl px-6 space-y-8">
        <header className="text-center space-y-2">
          <p className="text-2xl uppercase tracking-[0.3em] text-primary">Attendance Tracker</p>
          <h1 className="text-4xl md:text-5xl font-black text-base-content">Учёт посещаемости</h1>
          <p className="text-base-content/80">Выбирайте предмет и отмечайте посещение в один клик.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-3 bg-base-100 rounded-3xl p-6 shadow-xl border border-base-300">
          <div className="md:col-span-2 space-y-3">
            <p className="text-sm uppercase text-base-content/60">Выберите предмет</p>
            <div className="flex flex-wrap gap-3">
              {SUBJECTS.map(option => (
                <button
                  key={option.value}
                  className={`btn btn-sm md:btn-md rounded-full ${
                    selectedSubject === option.value ? "btn-primary" : "btn-outline"
                  }`}
                  onClick={() => setSelectedSubject(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-base-200 rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-sm uppercase text-base-content/60">Подключённый адрес</p>
            <Address
              address={connectedAddress}
              chain={targetNetwork}
              blockExplorerAddressLink={
                targetNetwork.id === hardhat.id ? `/blockexplorer/address/${connectedAddress}` : undefined
              }
            />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
          <div className="bg-base-100 rounded-3xl p-6 shadow-xl border border-base-300 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase text-base-content/60">Мой статус</p>
                <p className="text-2xl font-semibold">{myStatusLabel}</p>
                <p className="text-base-content/70">{SUBJECT_LABEL[selectedSubject]}</p>
              </div>
              <button className="btn btn-lg btn-primary" onClick={handleCheckIn} disabled={!canCheckIn}>
                {isPending ? "Подтвердите..." : "Отметиться"}
              </button>
            </div>
            {errMsg && <p className="text-error">{errMsg}</p>}
            <div className="divider" />
            <div className="space-y-4">
              <p className="text-sm uppercase text-base-content/60">Проверить адрес</p>
              <AddressInput placeholder="0xabc..." value={lookupAddr} onChange={value => setLookupAddr(value ?? "")} />
              <div className="text-lg">
                Статус: <b>{lookupLabel}</b>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-base-100 rounded-3xl p-6 shadow-xl border border-base-300">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <p className="text-sm uppercase text-base-content/60">История посещений</p>
              <h2 className="text-2xl font-semibold">Все события</h2>
            </div>
          </div>

          {events.length === 0 && <p className="opacity-70">Событий пока нет</p>}

          <div className="space-y-4">
            {events.map(ev => (
              <div key={ev.id} className="p-4 rounded-2xl bg-base-200 flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="badge badge-secondary">{SUBJECT_LABEL[ev.subject]}</span>
                  <span className="text-sm opacity-70">{ev.timestamp}</span>
                </div>
                <Address
                  address={ev.student}
                  chain={targetNetwork}
                  blockExplorerAddressLink={
                    targetNetwork.id === hardhat.id ? `/blockexplorer/address/${ev.student}` : undefined
                  }
                  format="short"
                />
                <span className="text-xs opacity-60">ID: {ev.id}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-base-100 rounded-3xl p-6 shadow-xl border border-base-300 space-y-4">
          <p className="text-sm uppercase text-base-content/60">Подсказки</p>
          <div className="rounded-2xl bg-base-200 p-4 space-y-2">
            <p className="font-semibold">Отладка</p>
            <p className="text-sm opacity-80">
              Изучайте контракт через{" "}
              <Link href="/debug" className="link">
                Debug Contracts
              </Link>
              .
            </p>
          </div>
          <div className="rounded-2xl bg-base-200 p-4 space-y-2">
            <p className="font-semibold">Блоки</p>
            <p className="text-sm opacity-80">
              Анализируйте транзакции во{" "}
              <Link href="/blockexplorer" className="link">
                Block Explorer
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
