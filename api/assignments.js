const express = require('express');
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const { insertNewAssignment, getAssignmentsByUserId, getAssignmentById, updateAssignment, deleteAssignment, Assignment } = require('../models/assignment');
const { Submission, insertNewSubmission} = require('../models/submission')
const { authenticate, checkAdminToken } = require('../lib/auth');
const { Course, isUserEnrolledInCourse } = require('../models/course');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const router = express.Router();

const assignmentSchema = {
    courseId: { required: true },
    title: { required: true },
    points: { required: true },
    due: { required: true }
};

// Configure Multer to store files in the 'uploads' directory
const storage = multer.diskStorage({
    destination: `${__dirname}/../assignment_submissions/`,
    filename: (req, file, callback) => {
        const filename = crypto.randomBytes(16).toString('hex');
        const extension = path.extname(file.originalname);
        callback(null, `${filename}${extension}`);
    }
});

const upload = multer({ storage: storage });

/*
 * Route to submit a new assignment
 */
router.post('/', authenticate, async function (req, res, next) {
    try {
        if (!validateAgainstSchema(req.body, assignmentSchema)) {
            return res.status(400).send({
                error: "Request body is not a valid assignment object"
            });
        }

        const assignment = extractValidFields(req.body, assignmentSchema);
        assignment.userId = req.auth_userId;

        const id = await insertNewAssignment(assignment);
        res.status(201).send({
            id: id
        });
    } catch (err) {
        next(err);
    }
});

/*
 * Route to get assignments for a user with pagination
 */
router.get('/user/:userId', authenticate, async function (req, res, next) {
    try {
        const userId = parseInt(req.params.userId, 10);
        let page = parseInt(req.query.page) || 1;
        page = page < 1 ? 1 : page;
        const numPerPage = 5;
        const offset = (page - 1) * numPerPage;

        if (req.auth_userId !== userId && req.auth_role !== 'admin') {
            return res.status(403).send({
                error: "Unauthorized to access the specified resource"
            });
        }

        const result = await getAssignmentsByUserId(userId, offset, numPerPage);
        res.status(200).send({
            assignments: result.rows,
            page: page,
            totalPages: Math.ceil(result.count / numPerPage),
            totalCount: result.count
        });
    } catch (err) {
        next(err);
    }
});

/*
 * Route to get a specific assignment by ID
 */
router.get('/:assignmentId', authenticate, async function (req, res, next) {
    try {
        const assignmentId = parseInt(req.params.assignmentId, 10);
        const assignment = await getAssignmentById(assignmentId);

        if (!assignment) {
            return res.status(404).send({
                error: "Assignment not found"
            });
        }

        res.status(200).send(assignment);
    } catch (err) {
        next(err);
    }
});

/*
 * Route to update an assignment
 */
router.patch('/:assignmentId', authenticate, async function (req, res, next) {
    try {
        if (!validateAgainstSchema(req.body, assignmentSchema)) {
            return res.status(400).send({
                error: "Request body is not a valid assignment object"
            });
        }

        const assignmentId = parseInt(req.params.assignmentId, 10);
        const assignment = extractValidFields(req.body, assignmentSchema);
        
        const updated = await updateAssignment(assignmentId, assignment);

        if (updated) {
            res.status(200).send({
                success: "Assignment updated successfully"
            });
        } else {
            res.status(404).send({
                error: "Assignment not found"
            });
        }
    } catch (err) {
        next(err);
    }
});

/*
 * Route to delete an assignment
 */
router.delete('/:assignmentId', authenticate, async function (req, res, next) {
    try {
        const assignmentId = parseInt(req.params.assignmentId, 10);
        const deleted = await deleteAssignment(assignmentId);

        if (deleted) {
            res.status(204).end();
        } else {
            res.status(404).send({
                error: "Assignment not found"
            });
        }
    } catch (err) {
        next(err);
    }
});

/*
 * Route to get submissions for an assignment
 */
router.get('/:assignmentId/submissions', authenticate, async function (req, res, next) {
    const assignmentId = req.params.assignmentId;
    
    let page = parseInt(req.query.page) || 1
    console.log("== page num is ", page)
    page = page < 1 ? 1 : page  //if page is less than 1, make it 1, otherwise leave it
    console.log("== page num is now ", page)
    const numPerPage = 5
    const offset = (page - 1) * numPerPage

        //get a filter going, what we want to look through
        const filter = {}
        //add something for the page here
        if (req.query.studentId) {
          filter.studentId = req.query.studentId
        }


    const assignment = await Assignment.findOne({
        where: { id: assignmentId },
        include: [{ model: Course, as: 'course' }]
        });
    const checkAdmin = await checkAdminToken(req, res);
    if (!checkAdmin) {
        if (req.auth_role != "instructor" || req.auth_userId != assignment.course.instructorId) {
            return res.status(403).send({
                error: "Only an admin or this course's instructor may edit this course!"
            });
        }
    }

    if (!assignment) {
        return res.status(404).send({
            error: "An Assignment does not exist with that id!"
        });
    }
    const result = await Submission.findAndCountAll({
        limit: numPerPage,
        where: filter,
        offset: offset
    })
    res.status(200).send({
        submissions: result.rows, 
        pageNumber: page 
    })
});

/*
 * Route to submit a submission for an assignment
 */
router.post('/:assignmentId/submissions', authenticate, upload.single('file'), async function (req, res, next) {
    try {
        const assignmentId = parseInt(req.params.assignmentId, 10);

        // Get the assignment
        const assignment = await getAssignmentById(assignmentId);

        // Check if it exists
        if (!assignment) {
            return res.status(404).send({
                error: "An Assignment does not exist with that id!"
            });
        }

        // Check if the user is a student
        if (req.auth_role !== "student") {
            return res.status(403).send({
                error: "Only a student may submit a submission!"
            });
        }

        // Check if the user is enrolled in the course
        const enrolled = await isUserEnrolledInCourse(parseInt(req.auth_userId, 10), parseInt(assignment.courseId, 10));
        if (!enrolled) {
            return res.status(403).send({
                error: "You are not enrolled in this course!"
            });
        }

        // Get a current timestamp in ISO 8601 format
        const now = new Date().toISOString();

        if (req.body.grade) {
            return res.status(400).send({
                error: "You cannot submit a grade with a submission!"
            });
        }

        if (!req.file) {
            return res.status(400).send({ error: 'No file uploaded' });
        }

        const submission = {
            assignmentId: assignmentId,
            studentId: req.auth_userId,
            timestamp: now,
            file: req.file.filename // stored in /assignment_submissions/file
        };

        // Insert the submission in the database
        const submissionId = await insertNewSubmission(submission);

        res.status(201).send({ id: submissionId });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
