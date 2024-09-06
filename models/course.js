const { DataTypes } = require("sequelize");
const sequelize = require("../lib/sequelize");
const { Assignment } = require("./assignment");
const { User } = require("./user");

const Course = sequelize.define("course", {
  subject: { type: DataTypes.STRING, allowNull: false },
  number: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  term: { type: DataTypes.STRING, allowNull: false },
  instructorId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
});

//This manages the many to many relationship between students and courses
// and I believe that when course.addUsers() or user.addCourses() is called, it goes through 
// this? im not sure
const CourseStudents = sequelize.define('coursestudents', {
  courseId: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    references: {
      model: Course,
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    defaultValue: 1,
  }
});

Course.hasMany(Assignment, {
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
  foreignKey: { allowNull: false }
});

Assignment.belongsTo(Course);

Course.belongsToMany(User, { through: CourseStudents });
User.belongsToMany(Course, { through: CourseStudents });


exports.isUserEnrolledInCourse = async function (userId, courseId) {
  try {
    const user = await User.findByPk(userId);
    const course = await Course.findByPk(courseId);

    if (!user || !course) {
      return false; // User or Course not found
    }

    // Check if the user is associated with the course through CourseStudents
    const isEnrolled = await user.hasCourse(course); // This leverages the `belongsToMany` association
    return isEnrolled;
  } catch (error) {
    console.error("Error checking enrollment:", error);
    throw error;
  }
}


exports.Course = Course;
exports.CourseStudents = CourseStudents;

exports.CourseClientFields = [
  "subject",
  "number",
  "title",
  "term",
  "instructorId",
];