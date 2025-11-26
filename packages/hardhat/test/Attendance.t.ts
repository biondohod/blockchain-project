import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { viem } from "hardhat";
import { parseEventLogs } from "viem";

const SUBJECT = {
  Programming: 0,
  English: 1,
  Math: 2,
} as const;

describe("Attendance", () => {
  async function deployAttendanceFixture() {
    const [teacher, student, otherStudent] = await viem.getWalletClients();
    const attendance = await viem.deployContract("Attendance", [], {
      account: teacher.account,
    });
    const publicClient = await viem.getPublicClient();
    return { attendance, teacher, student, otherStudent, publicClient };
  }

  it("records attendance via checkIn", async () => {
    const { attendance, student } = await loadFixture(deployAttendanceFixture);

    expect(await attendance.read.isPresent([SUBJECT.Programming, student.account.address])).to.equal(false);

    await attendance.write.checkIn([SUBJECT.Programming], { account: student.account });

    expect(await attendance.read.isPresent([SUBJECT.Programming, student.account.address])).to.equal(true);
  });

  it("emits CheckedIn events", async () => {
    const { attendance, student, publicClient } = await loadFixture(deployAttendanceFixture);

    const txHash = await attendance.write.checkIn([SUBJECT.English], { account: student.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const logs = parseEventLogs({
      abi: attendance.abi,
      logs: receipt.logs,
      eventName: "CheckedIn",
    });

    expect(logs).to.have.lengthOf(1);
    expect(logs[0].args.student).to.equal(student.account.address);
    expect(Number(logs[0].args.subject)).to.equal(SUBJECT.English);
  });

  it("reverts on duplicate checkIn calls", async () => {
    const { attendance, student } = await loadFixture(deployAttendanceFixture);

    await attendance.write.checkIn([SUBJECT.Math], { account: student.account });

    await attendance.write
      .checkIn([SUBJECT.Math], { account: student.account })
      .then(() => expect.fail("Expected revert for repeated check-in"))
      .catch(error => {
        expect(error?.shortMessage ?? error?.message).to.contain("Already checked in");
      });
  });

  it("returns accurate presence information", async () => {
    const { attendance, student, otherStudent } = await loadFixture(deployAttendanceFixture);

    await attendance.write.checkIn([SUBJECT.Programming], { account: student.account });

    expect(await attendance.read.isPresent([SUBJECT.Programming, student.account.address])).to.equal(true);
    expect(await attendance.read.isPresent([SUBJECT.Programming, otherStudent.account.address])).to.equal(false);
    expect(await attendance.read.isPresent([SUBJECT.Math, student.account.address])).to.equal(false);
  });
});
