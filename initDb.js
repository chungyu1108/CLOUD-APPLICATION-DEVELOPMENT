require("dotenv").config();
const sequelize = require('./lib/sequelize.js');
const { User, UserClientFields } = require('./models/user');
const { Course, CourseClientFields } = require('./models/course');
const { Assignment, AssignmentClientFields } = require('./models/assignment');
const { Submission, SubmissionClientFields } = require('./models/submission');

const userData = require('./data/users.json');
const courseData = require('./data/courses.json');
const assignmentData = require('./data/assignments.json');
const submissionData = require('./data/submissions.json');

async function createDummyData() {
  try {
    await sequelize.sync();

    await User.bulkCreate(userData, { fields: UserClientFields });
    await Course.bulkCreate(courseData, { fields: CourseClientFields });
    await Assignment.bulkCreate(assignmentData, { fields: AssignmentClientFields });
    await Submission.bulkCreate(submissionData, { fields: SubmissionClientFields });

    console.log('Dummy data created successfully.');
  } catch (error) {
    console.error('Error creating dummy data:', error);
  }
}

createDummyData();