const { DataTypes } = require("sequelize");
const sequelize = require("../lib/sequelize");
const { Submission } = require("./submission");

const Assignment = sequelize.define("assignment", {
  courseId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  points: { type: DataTypes.INTEGER, allowNull: false },
  due: { type: DataTypes.STRING, allowNull: false },
});

Assignment.hasMany(Submission, {
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
  foreignKey: { allowNull: false }
});

Submission.belongsTo(Assignment);

async function insertNewAssignment(assignment) {
  const result = await Assignment.create(assignment);
  return result.id;
}

async function getAssignmentsByUserId(userId, offset, limit) {
  const result = await Assignment.findAndCountAll({
    where: { userId: userId },
    offset: offset,
    limit: limit
  });
  return result;
}

async function getAssignmentById(assignmentId) {
  return await Assignment.findByPk(assignmentId);
}

async function updateAssignment(assignmentId, assignment) {
  const [updated] = await Assignment.update(assignment, {
    where: { id: assignmentId }
  });
  return updated > 0;
}

async function deleteAssignment(assignmentId) {
  const deleted = await Assignment.destroy({
    where: { id: assignmentId }
  });
  return deleted > 0;
}

module.exports = {
  Assignment,
  insertNewAssignment,
  getAssignmentsByUserId,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  AssignmentClientFields: ["courseId", "title", "points", "due"]
};
