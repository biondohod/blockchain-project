// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract Attendance {
    address public teacher;

    enum Subject {
        Programming,
        English,
        Math
    }

    mapping(Subject => mapping(address => bool)) public attended;

    event CheckedIn(address indexed student, Subject indexed subject);

    modifier onlyTeacher() {
        require(msg.sender == teacher, "Only teacher");
        _;
    }

    constructor() {
        teacher = msg.sender;
    }

    function checkIn(Subject subject) external {
        require(!attended[subject][msg.sender], "Already checked in");
        attended[subject][msg.sender] = true;
        emit CheckedIn(msg.sender, subject);
    }

    function isPresent(Subject subject, address student) external view returns (bool) {
        return attended[subject][student];
    }
}

