// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract GradesManager {
    address public teacher;
    mapping(address => uint8) private grades;

    event GradeSet(address indexed by, address indexed student, uint8 grade);

    modifier onlyTeacher() {
        require(msg.sender == teacher, "Only teacher");
        _;
    }

    constructor() {
        teacher = msg.sender;
    }

    function getMyGrade() external view returns (uint8) {
        return grades[msg.sender];
    }

    function getGrade(address student) external view returns (uint8) {
        return grades[student];
    }

    function setGrade(address student, uint8 grade) external onlyTeacher {
        require(student != address(0), "Bad student");
        require(grade <= 100, "Grade out of range");
        grades[student] = grade;
        emit GradeSet(msg.sender, student, grade);
    }
}
