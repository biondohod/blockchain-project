"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  useScaffoldReadContract,
  useScaffoldWatchContractEvent,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";

const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

type EventEntry = {
  id: string;
  teacher: string;
  student: string;
  grade: string;
  time: string;
};

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  // --- READ: моя оценка ---
  const { data: myGrade, refetch: refetchMy } = useScaffoldReadContract({
    contractName: "GradesManager",
    functionName: "getMyGrade",
    watch: true,
    account: connectedAddress,
  });

  // --- READ: оценка студента ---
  const [lookupAddr, setLookupAddr] = useState("");
  const lookupArgs = useMemo(() => (isAddress(lookupAddr) ? [lookupAddr as `0x${string}`] : undefined), [lookupAddr]);

  const { data: lookedUpGrade, refetch: refetchLookup } = useScaffoldReadContract({
    contractName: "GradesManager",
    functionName: "getGrade",
    args: lookupArgs,
    enabled: !!lookupArgs,
    watch: true,
  });

  // --- WRITE: setGrade ---
  const [studentAddr, setStudentAddr] = useState("");
  const [gradeVal, setGradeVal] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const { writeContractAsync, isPending } = useScaffoldWriteContract("GradesManager");

  const canSubmit = useMemo(() => {
    const n = Number(gradeVal);
    return isAddress(studentAddr) && Number.isFinite(n) && n >= 0 && n <= 100 && !isPending;
  }, [studentAddr, gradeVal, isPending]);

  async function setGrade() {
    try {
      setErrMsg(null);

      if (!isAddress(studentAddr)) throw new Error("Введите корректный адрес студента (0x...)");

      const n = Number(gradeVal);
      if (n < 0 || n > 100 || !Number.isFinite(n)) throw new Error("Оценка должна быть в диапазоне 0..100");

      await writeContractAsync({
        functionName: "setGrade",
        args: [studentAddr as `0x${string}`, BigInt(n)],
      });

      setGradeVal("");

      refetchMy?.();
      refetchLookup?.();
    } catch (e: any) {
      setErrMsg(e?.shortMessage || e?.message || "Transaction failed");
    }
  }

  // Автовставка адреса в просмотр оценки
  useEffect(() => {
    if (connectedAddress && !lookupAddr) setLookupAddr(connectedAddress);
  }, [connectedAddress, lookupAddr]);

  // --- EVENTS: журнал ---
  const [events, setEvents] = useState<EventEntry[]>([]);

  useScaffoldWatchContractEvent({
    contractName: "GradesManager",
    eventName: "GradeSet",
    onLogs: logs => {
      setEvents(prev => {
        const newEvents = logs.map(log => ({
          id: `${log.transactionHash}-${log.logIndex}`,
          teacher: log.args.teacher?.toString() || "",
          student: log.args.student?.toString() || "",
          grade: log.args.grade?.toString() || "",
          time: new Date().toLocaleTimeString(),
        }));

        const existingIds = new Set(prev.map(ev => ev.id));
        const uniqueNewEvents = newEvents.filter(ev => !existingIds.has(ev.id));

        return [...uniqueNewEvents, ...prev];
      });
    },
  });

  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5 w-full max-w-4xl">
        <h1 className="text-center">
          <span className="block text-2xl mb-2">Grades Manager</span>
          <span className="block text-4xl font-bold">Чтение и запись оценок</span>
        </h1>

        {/* Connected */}
        <div className="flex justify-center items-center flex-col mt-6">
          <p className="my-2 font-medium">Подключённый адрес:</p>
          <Address
            address={connectedAddress}
            chain={targetNetwork}
            blockExplorerAddressLink={
              targetNetwork.id === hardhat.id ? `/blockexplorer/address/${connectedAddress}` : undefined
            }
          />
        </div>

        {/* READ */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-base-100 rounded-3xl p-6 shadow">
            <h2 className="text-xl font-semibold mb-3">Моя оценка</h2>
            <p className="text-lg">{myGrade !== undefined ? <b>{myGrade.toString()}</b> : "--"}</p>
          </div>

          <div className="bg-base-100 rounded-3xl p-6 shadow">
            <h2 className="text-xl font-semibold mb-3">Проверить оценку студента</h2>
            <input
              className="input input-bordered w-full"
              placeholder="0xabc..."
              value={lookupAddr}
              onChange={e => setLookupAddr(e.target.value)}
            />
            <p className="mt-3">
              Оценка: <b>{lookedUpGrade !== undefined ? lookedUpGrade.toString() : "--"}</b>
            </p>
          </div>
        </div>

        {/* WRITE */}
        <div className="bg-base-100 rounded-3xl p-6 shadow mt-8">
          <h2 className="text-xl font-semibold mb-3">Выставить/обновить оценку</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="input input-bordered w-full"
              placeholder="Адрес студента 0x..."
              value={studentAddr}
              onChange={e => setStudentAddr(e.target.value)}
            />

            <input
              className="input input-bordered w-full"
              placeholder="Напр.: 95"
              value={gradeVal}
              onChange={e => setGradeVal(e.target.value)}
            />
          </div>

          {errMsg && <p className="text-error mt-2">{errMsg}</p>}

          <button className="btn btn-primary mt-4" onClick={setGrade} disabled={!canSubmit}>
            {isPending ? "Подтвердите в MetaMask..." : "Сохранить оценку"}
          </button>
        </div>

        {/* EVENTS */}
        <div className="bg-base-100 rounded-3xl p-6 shadow mt-10">
          <h2 className="text-xl font-semibold mb-3">История выставления оценок</h2>

          {events.length === 0 && <p className="opacity-70">Пока нет событий</p>}

          {events.map(ev => (
            <div key={ev.id} className="border-b border-base-300 py-2 text-sm">
              <p>
                <b>{ev.teacher}</b> поставил <b>{ev.grade}</b> студенту <b>{ev.student}</b>
              </p>
              <p className="opacity-60">{ev.time}</p>
            </div>
          ))}
        </div>

        {/* Helpers */}
        <div className="grow bg-base-300 w-full mt-16 px-8 py-12 rounded-3xl">
          <div className="flex justify-center items-center gap-12 flex-col md:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>

            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
