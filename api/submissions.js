const {Router} = require('express')


const { Submission, SubmissionClientFields } = require('../models/submission')
const { Assignment } = require('../models/assignment')
const { Course, CourseClientFields, CourseStudents } = require('../models/course')
const { insertNewAssignment, getAssignmentsByUserId, getAssignmentById, updateAssignment, deleteAssignment } = require('../models/assignment')
const { generateAuthToken, authenticate , checkAdminToken } = require('../lib/auth')
const multer = require('multer')
const crypto = require("node:crypto")
const path = require('path');

const router = Router();

// Configure Multer to store files in the 'uploads' directory
const storage = multer.diskStorage({
    destination: `${__dirname}/../assignment_submissions/`,
    filename: (req, file, callback) => {
        const filename = crypto.pseudoRandomBytes(16).toString("hex")
        const extension = path.extname(file.originalname);
        callback(null, `${filename}${extension}`)
    }
});

const upload = multer({ storage: storage });


router.patch('/:submissionId', authenticate, upload.single('file'), async function (req, res, next) {
    const submissionId = req.params.submissionId 
    const submission = await Submission.findOne({ where: {id: submissionId}})

    const allowedKeys = ['grade', 'assignmentId', 'studentId'];
    // Check if any keys in req.body are not allowed
    const invalidKeys = Object.keys(req.body).filter(key => !allowedKeys.includes(key))
    if (invalidKeys.length > 0) {
        return res.status(400).send({
            error: "Pass in valid objects to patch"
        });
    }
    //console.log("== submission", submission)
    if(!submission) {
        console.log("submission")
        return res.status(404).send({
            error: "A submission does not exist with that id!"
        })
    }
    //need to do some stuff because we want to check that only the instructor of the course or admin can change grade
    const assignment = await Assignment.findOne({ where: {id: submission.assignmentId}})
    const course = await Course.findOne({where: {id: assignment.courseId}})
    console.log("== assignmentId is ", submission.assignmentId, "courseId is ", assignment.courseId, "instructorId is ", course.instructorId)
    const checkAdmin = await checkAdminToken(req, res)
    if(!checkAdmin) {
        if(req.auth_role != "instructor" || req.auth_userId != course.instructorId) {
            return res.status(403).send({
                error: "Only an admin or this course's instructor may edit this submission!"
            })
        }
    }
    if (req.file.filename){
        req.body.file = req.file.filename
    }
    try {
        const result = await Submission.update(req.body, {
            where: { id: submissionId },
            fields: SubmissionClientFields //only updating the fields specified in SubmissionClientFields
        })
        if (result[0] > 0) {    //this checks if something was successfully updated
            res.status(204).send()
        } else {
            next()
        }
    } catch(e) {
        next(e)
    }
})

router.get('/:fileName', authenticate, async(req, res, next) => {
    url = `media/submissions/${req.params.fileName}`
    res.status(200).send(url)
})

module.exports = router;