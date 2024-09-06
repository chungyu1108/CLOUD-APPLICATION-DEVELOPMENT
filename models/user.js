
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../lib/sequelize.js');  // Adjust the path as needed
const { Submission } = require('./submission');

const User = sequelize.define('user', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      const salt = bcrypt.genSaltSync(8);
      const hash = bcrypt.hashSync(value, salt);
      this.setDataValue('password', hash);
    },
  },
  role: {
    type: DataTypes.ENUM,
    values: ['admin', 'instructor', 'student'],
    defaultValue: 'student',
  },
});

User.prototype.checkPassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

//I set this to allowNull true because we don't actually need to track submissions to as that is not a required API call
User.hasMany(Submission, { foreignKey: { allowNull: true } });
Submission.belongsTo(User);
exports.User = User;

exports.UserClientFields = [
  'name',
  'email',
  'password',
  'role'
];


// Check if the email is already in use
// Returns true if the email is in use and false otherwise
exports.checkEmailInUSe = async function (email) {
  const user = await User.findOne({
    where: {
      email: email
    }
  });
  return user !== null;
}

// Insert a new user into the database
// Returns the new user id
exports.insertNewUser = async function (user) {
  const newUser = await User.create(user);
  return newUser.id;
}

exports.valiadateEmailPassword = async function (email, password) {
  const user = await User.findOne({
    where: {
      email: email
    }
  })
  if (user && await bcrypt.compare(password, user.password)) {
    return user
  } else {
      return null
  }
}

exports.getUserById = async function (id) {
  user = await User.findByPk(id)
  if (user) {
    return user
  } else {
    return null
  }
}

exports.getStudentCourses = async function (id) {
  //given userId, return a list of CourseIds that the user is enrolled in (something with CourseStudents table)
}

exports.getInstructorCourses = async function (id) {
  //given userId, return a list of CourseIds that the user is an instructor for (something with Course table)
}