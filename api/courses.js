const {Router} = require('express')


const { User } = require('../models/user')
const { Course, CourseClientFields, CourseStudents } = require('../models/course')
const { validateAgainstSchema, extractValidFields } = require('../lib/validation')
const { generateAuthToken, authenticate , checkAdminToken } = require('../lib/auth')

const fs = require('fs');
const path = require('path');

const { format } = require('@fast-csv/format');

const router = Router();


const courseSchema = {
    subject: { required: true },
    number: { required: true },
    title: { required: true },
    term: { required: true },
    instructorId: { required: true }
}

//Fetch a list of all the courses
//add pagination
router.get('/', async function (req, res) {
    //can check page, subject, number (493), and term (sp22)

    let page = parseInt(req.query.page) || 1
    console.log("== page num is ", page)
    page = page < 1 ? 1 : page  //if page is less than 1, make it 1, otherwise leave it
    console.log("== page num is now ", page)
    const numPerPage = 5
    const offset = (page - 1) * numPerPage

    try {
        //get a filter going, what we want to look through
        const filter = {}
        //add something for the page here
        if (req.query.subject) {
          filter.subject = req.query.subject
        }
        if (req.query.number) {
          filter.number = req.query.number
        }
        if (req.query.term) {
            filter.term = req.query.term
        }
        //lets find the classes according to the filter requirements, set it equal to results
        const result = await Course.findAndCountAll({
            limit: numPerPage,
            where: filter,
            offset: offset
        })
        //send back to client
        res.status(200).send({
            courses: result.rows, 
            pageNumber: page 
        })
    } catch(e) {
        next(e)
    }

})

//Create a new course
router.post('/', async function (req, res, next) {
    try {
        if(!validateAgainstSchema(req.body, courseSchema)) {
            return res.status(400).send({
                error: "Request body is not a valid course object"
            })
        }
        const checkAdmin = await checkAdminToken(req, res)  //check if admin, bool I believe
        if(!checkAdmin) {   //if they aren't an admin, they can't create a course
            return res.status(403).send({
                error: "You need to be an admin to create a course!"
            })
        }
        const course = await Course.create(req.body, CourseClientFields)
        res.status(201).send({ id: course.id })
    } catch(e) {
        next(e)
    }
})


//Fetch data about a specific Course
router.get('/:courseId', async function (req, res, next) {
    const courseId = req.params.courseId 
    try {
        const course = await Course.findOne({ where: {id: courseId }})  //the primary key for a course is its id
        if(course) {
            //might have to switch this to send only specific parts of the course
            res.status(200).send(course)
        } else {
            return res.status(404).send({
                error: "A course with this ID does not exist"
            })
        }
    } catch(e) {
        next(e)
    }
})

//Update data for a specific course
router.patch('/:courseId', authenticate, async function (req, res, next) {
    const courseId = req.params.courseId 
    const course = await Course.findOne({ where: { id: courseId }})

    // Define allowed keys
    const allowedKeys = ['subject', 'number', 'title', 'term', 'instructorId'];
    // Check if any keys in req.body are not allowed
    const invalidKeys = Object.keys(req.body).filter(key => !allowedKeys.includes(key))
    if (invalidKeys.length > 0) {
        return res.status(400).send({
            error: "Pass in valid objects to patch"
        });
    }

    if(!course) {
        return res.status(404).send({
            error: "A course does not exist with that id!"
        })
    }
    const checkAdmin = await checkAdminToken(req, res)
    if(!checkAdmin) {
        if(req.auth_role != "instructor" || req.auth_userId != course.instructorId) {
            return res.status(403).send({
                error: "Only an admin or this course's instructor may edit this course!"
            })
        }
    }

    try {
        const result = await Course.update(req.body, {
            where: { id: courseId },
            fields: CourseClientFields //only updating the fields specified in CourseClientFields
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


//Remove a specific Course from the database
router.delete('/:courseId', async function (req, res, next) {
    const checkAdmin = await checkAdminToken(req, res)
    if(!checkAdmin) {
        res.status(403).send({
            error: "You must be an admin to delete a course!"
        })
    }

    const courseId = req.params.courseId 
    const course = await Course.findOne({ where: { id: courseId }})

    if(!course) {
        return res.status(404).send({
            error: "A course does not exist with that id!"
        })
    }

    try {
        const result = await Course.destroy({ where: {id: courseId }})
        if (result > 0) {    //this checks if something was successfully updated
            res.status(204).send()
        } else {
            next()
        }
    } catch(e) {
        next(e)
    }
})

//fetch a list of all the students enrolled in a specific Course
router.get('/:courseId/students', authenticate, async function (req, res, next) {
    const courseId = req.params.courseId
    const course = await Course.findOne({ where: { id: courseId }})

    //error handling
    if(!course) {
        return res.status(404).send({
            error: "A course does not exist with that id!"
        })
    }
    const checkAdmin = await checkAdminToken(req, res)
    if(!checkAdmin) {
        if(req.auth_role != "instructor" || req.auth_userId != course.instructorId) {
            return res.status(403).send({
                error: "Only an admin or this course's instructor may edit this course!"
            })
        }
    }

    const students = await course.getUsers()    //get all the users in a students course
    res.status(200).send({
        students: students.map(student => ({
            name: student.name,
            email: student.email,
            password: student.password,
            role: student.role
        }))
    })
})


//Add or remove students from a Course
router.post('/:courseId/students', authenticate, async function (req, res, next) {
    //enrolls and/or unenrolls students from a course
    const courseId = req.params.courseId
    const { add = [], remove = [] } = req.body  //fill up a list of add and remove with the req.body add and removes
    console.log("== add is ", add, " and remove is ", remove)
    const course = await Course.findOne({ where: {id: courseId }})

    // Define allowed keys
    const allowedKeys = ['add', 'remove'];
    // Check if any keys in req.body are not allowed
    const invalidKeys = Object.keys(req.body).filter(key => !allowedKeys.includes(key))
    if (invalidKeys.length > 0) {
        return res.status(400).send({
            error: "Pass in valid objects to post"
        });
    }

    if(!course) {
        return res.status(404).send({
            error: "A course does not exist with that id!"
        })
    }
    const checkAdmin = await checkAdminToken(req, res)
    if(!checkAdmin) {
        if(req.auth_role != "instructor" || req.auth_userId != course.instructorId) {
            return res.status(403).send({
                error: "Only an admin or this course's instructor may edit this course!"
            })
        }
    }


    try {
        if (add.length > 0) {   //if there are id's to add in the req.body
            console.log("== gonna add some users")
            const usersToAdd = await User.findAll({
                where: {
                    id: add
                }
            });
            await course.addUsers(usersToAdd)
        }

        if (remove.length > 0) {    //if there are any id's to remove in req.body
            console.log("== gonna remove some users")
            const usersToRemove = await User.findAll({
                where: {
                    id: remove
                }
            });
            await course.removeUsers(usersToRemove);
        }
        res.status(200).send() //if that all worked, send back 200 
    } catch(e) {
        next(e)
    }
})
/*
//help for this gotten from chatgpt
function generateCSV(students, res) {
    const csvStream = format({ headers: true })

    // Set response headers for CSV file download
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="course_roster.csv"`)

    // Pipe the CSV stream to the response
    csvStream.pipe(res)

    // Write student data to the CSV stream
    students.forEach(student => {
        csvStream.write({
            id: student.id,
            name: student.name,
            email: student.email
        });
    });

    // End the CSV stream
    csvStream.end()
}


//Fetch a csv file containting list of all the students enrolled in the course
router.get('/:courseId/roster', authenticate, async function (req, res, next) {
    const courseId = req.params.courseId 
    const course = await Course.findOne({ where: {id: courseId }})  //get the course

    if(!course) {
        return res.status(404).send({
            error: "A course does not exist with that id!"
        })
    }
    const checkAdmin = await checkAdminToken(req, res)
    if(!checkAdmin) {
        if(req.auth_role != "instructor" || req.auth_userId != course.instructorId) {
            return res.status(403).send({
                error: "Only an admin or this course's instructor may edit this course!"
            })
        }
    }

    const students = await course.getUsers({ where: {role: "student" }})    //get all the users in a students course
    generateCSV(students, res)
})
*/

//downoadable file
async function generateCSVFile(students, filePath) {
    const csvStream = format({ headers: true });
    const writableStream = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
        writableStream.on('finish', resolve);
        writableStream.on('error', reject);

        csvStream.pipe(writableStream);

        // Write student data to the CSV stream
        students.forEach(student => {
            csvStream.write({
                id: student.id,
                name: student.name,
                email: student.email
            });
        });

        // End the CSV stream
        csvStream.end();
    });
}
router.get('/:courseId/roster', authenticate, async function (req, res, next) {
    const courseId = req.params.courseId 
    const course = await Course.findOne({ where: {id: courseId }})  //get the course

    if(!course) {
        return res.status(404).send({
            error: "A course does not exist with that id!"
        })
    }
    const checkAdmin = await checkAdminToken(req, res)
    if(!checkAdmin) {
        if(req.auth_role != "instructor" || req.auth_userId != course.instructorId) {
            return res.status(403).send({
                error: "Only an admin or this course's instructor may edit this course!"
            })
        }
    }

    const students = await course.getUsers({ where: {role: "student" }})    //get all the users in a students course
    // Define the file path for the temporary CSV file
    const filePath = path.join(__dirname, 'temp', `course_roster_${courseId}.csv`);

    // Ensure the 'temp' directory exists
    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
        fs.mkdirSync(path.join(__dirname, 'temp'));
    }

    try {
        // Generate the CSV file
        await generateCSVFile(students, filePath);

        // Send the CSV file to the client
        res.sendFile(filePath, (err) => {
            if (err) {
                next(err);
            } else {
                // Cleanup: Delete the file after sending it
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`Error deleting file: ${filePath}`, err);
                    }
                });
            }
        });
    } catch (error) {
        next(error);
    }
})

//Fetch a list of all the assignments for the Course
router.get('/:courseId/assignments', async function (req, res, next) {
    const courseId = req.params.courseId
    const course = await Course.findOne({ where: {id: courseId }})

    if(!course) {
        return res.status(404).send({
            error: "A course does not exist with that id!"
        })
    }

    //now lets return all the assignment ids that belong to this course
    const assignments = await course.getAssignments()   //i tihnk with how we have the course.js and the assignment.js in models this works automatically?
    res.status(200).send({
        assignments: assignments
    })

})

module.exports = router;