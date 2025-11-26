import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { viem } from "hardhat";
import { parseEventLogs } from "viem";

const SUBJECT = {
  Programming: 0,
  English: 1,
  Math: 2,
} as const;

async function expectRevert(promise: Promise<unknown>, reason?: string) {
  try {
    await promise;
    expect.fail("Expected transaction to revert");
  } catch (error: any) {
    const message = String(error?.shortMessage ?? error?.cause?.shortMessage ?? error?.message ?? "");
    if (reason) {
      expect(message.toLowerCase()).to.contain(reason.toLowerCase());
    }
  }
}

describe("Attendance", () => {
  async function deployAttendanceFixture() {
    const [teacher, student, otherStudent] = await viem.getWalletClients();
    const attendance = await viem.deployContract("Attendance", [], {
      account: teacher.account,
    });
    const publicClient = await viem.getPublicClient();
    return { attendance, teacher, student, otherStudent, publicClient };
  }

  it("assigns the deployer as the teacher", async () => {
    const { attendance, teacher } = await loadFixture(deployAttendanceFixture);
    expect((await attendance.read.teacher()).toLowerCase()).to.equal(teacher.account.address.toLowerCase());
  });

  it("records attendance via checkIn", async () => {
    const { attendance, student } = await loadFixture(deployAttendanceFixture);

    expect(await attendance.read.isPresent([SUBJECT.Programming, student.account.address])).to.equal(false);

    await attendance.write.checkIn([SUBJECT.Programming], { account: student.account });

    expect(await attendance.read.isPresent([SUBJECT.Programming, student.account.address])).to.equal(true);
  });

  it("emits CheckedIn events per subject", async () => {
    const { attendance, student, publicClient } = await loadFixture(deployAttendanceFixture);

    const txHash = await attendance.write.checkIn([SUBJECT.English], { account: student.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const logs = parseEventLogs({
      abi: attendance.abi,
      logs: receipt.logs,
      eventName: "CheckedIn",
    });

    expect(logs).to.have.lengthOf(1);
    expect(String(logs[0].args.student).toLowerCase()).to.equal(student.account.address.toLowerCase());
    expect(Number(logs[0].args.subject)).to.equal(SUBJECT.English);
  });

  it("reverts on duplicate checkIn calls for the same subject", async () => {
    const { attendance, student } = await loadFixture(deployAttendanceFixture);

    await attendance.write.checkIn([SUBJECT.Math], { account: student.account });

    await expectRevert(attendance.write.checkIn([SUBJECT.Math], { account: student.account }));
  });

  it("allows the same student to check into multiple subjects", async () => {
    const { attendance, student } = await loadFixture(deployAttendanceFixture);

    await attendance.write.checkIn([SUBJECT.Programming], { account: student.account });
    expect(await attendance.read.isPresent([SUBJECT.Programming, student.account.address])).to.equal(true);
    expect(await attendance.read.isPresent([SUBJECT.English, student.account.address])).to.equal(false);

    await attendance.write.checkIn([SUBJECT.English], { account: student.account });
    expect(await attendance.read.isPresent([SUBJECT.English, student.account.address])).to.equal(true);
    expect(await attendance.read.isPresent([SUBJECT.Math, student.account.address])).to.equal(false);
  });

  it("returns accurate presence information per student and subject", async () => {
    const { attendance, student, otherStudent } = await loadFixture(deployAttendanceFixture);

    await attendance.write.checkIn([SUBJECT.Programming], { account: student.account });

    expect(await attendance.read.isPresent([SUBJECT.Programming, student.account.address])).to.equal(true);
    expect(await attendance.read.isPresent([SUBJECT.Programming, otherStudent.account.address])).to.equal(false);
    expect(await attendance.read.isPresent([SUBJECT.Math, student.account.address])).to.equal(false);
  });
});
