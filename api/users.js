const {Router} = require('express')

const { validateAgainstSchema, extractValidFields } = require('../lib/validation')

const { User, checkEmailInUSe, insertNewUser, valiadateEmailPassword, getStudentCourses, getInstructorCourses } = require('../models/user')

const { generateAuthToken, authenticate , checkAdminToken } = require('../lib/auth')

const { token } = require('morgan')

const router = Router();

const userSchema = {
  name: { required: true },
  email: { required: true },
  password: { required: true },
  role: { required: true }
}

const userLoginSchema = {
  email: { required: true },
  password: { required: true }
}

/*
 * Route to create a new user
 */
router.post('/', async function (req, res, next) {
    try {
        // Check if the request body is a valid user object
        if (!validateAgainstSchema(req.body, userSchema)) {
            return res.status(400).send({
            error: "Request body is not a valid user object"
            })
        }
    
        // extract the req.body fields
        const user = extractValidFields(req.body, userSchema)

        // Check if name, email, password, and role are all strings
        if (typeof user.name !== 'string' || typeof user.email !== 'string' || typeof user.password !== 'string' || typeof user.role !== 'string') {
            return res.status(400).send({
            error: "Request body fields are not valid"
            })
        } 

        // Check if the email is already in use
        const emailInUse = await checkEmailInUSe(user.email)
        if (emailInUse) {
            return res.status(400).send({
            error: "Email is already in use"
            })
        }
    
        //check if trying to create an admin user
        if (user.role === "admin") {
            const checkIfAdmin = await checkAdminToken(req,res)
            if (!checkIfAdmin) {
                return res.status(403).send({
                    error: "Unauthorized to create an admin user"
                })
            }
        }
        
        const id = await insertNewUser(user)
    
        return res.status(201).send({
            id: id
        })
    } catch (err) {
      next(err)
    }
})

/*
* Route to login a user
*/
router.post('/login', async function (req, res, next) {
    try {
        // Check if the request body is a valid userLogin object
        if (!validateAgainstSchema(req.body, userLoginSchema)) {
            return res.status(400).send({
            error: "Request body does not contailn required fields for LOGIN"
            })
        }

        // Check if email and password are strings
        if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string') {
            return res.status(400).send({
            error: "Request body fields are not valid"
            })
        }

        const user = await valiadateEmailPassword(req.body.email, req.body.password)
        if (user) {
            const token = generateAuthToken(user.id.toString(), user.role)
            return res.status(200).send({
            token: token
        })
        } else {
            return res.status(401).send({
            error: "Invalid authentication credentials"
            })
        }
    } catch (e) {
      next(e)
    }
})

/*
* Route to get user by id
*/
router.get('/:userId', authenticate, async function (req, res, next) {
    try {
        const userId =parseInt(req.params.userId, 10)
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
          });
        //Check that the user exists
        if (!user) {
            return res.status(404).send({
                error: "User not found"
            })
        }

        const checkAdmin = await checkAdminToken(req, res)  //check if admin, bool I believe


        //check that the token and userId match
        if (req.auth_userId !== req.params.userId && !checkAdmin) {
            console.log(req.user)
            return res.status(403).send({
                error: "Unauthorized to access the specified resource"
            })
        }

        //If the requested user is a student, append the list of CourseIds that the student is enrolled in
        if (user.role === "student") {
            const courses = await getStudentCourses(userId)
            user.courses = courses
        }

        //If the requested user is an instructor, append the list of CourseIds that the instructor is teaching
        if (user.role === "instructor") {
            const courses = await getInstructorCourses(userId)
            user.courses = courses
        }

        return res.status(200).send(user)

      
    } catch (e) {
      next(e)
    }
  })

  module.exports = router;