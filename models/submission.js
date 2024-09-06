const { DataTypes } = require('sequelize');
const sequelize = require("../lib/sequelize.js")

const Submission = sequelize.define('submission', {
    assignmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    studentId: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    timestamp: { 
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    grade: { 
        type: DataTypes.FLOAT, 
        defaultValue: 0,
        allowNull: true 
    },
    file: { 
        type: DataTypes.STRING, 
        allowNull: false 
    }
});


async function insertNewSubmission(submission) {
    const result = await Submission.create(submission);
    return result.id;
  }

exports.Submission = Submission;
exports.insertNewSubmission = insertNewSubmission

exports.SubmissionClientFields = [
    'assignmentId',
    'studentId',
    'file',
    'grade'
];