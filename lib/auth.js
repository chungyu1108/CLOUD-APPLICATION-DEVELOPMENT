const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const secretKey = 'your_secret_key';

// Generate a token
// The token will expire in 999 hours
// Gets passed the UserId and Role
// Returns a token
// token.sub = userId
// token.role = role
const generateAuthToken = function (userId, role) {
  const payload = {
    sub: userId,
    role: role
  }
  return jwt.sign(payload, secretKey, { expiresIn: "999h" })
}

// Authenticate a request
// Gets passed the request, response, and next (Importantly, the request containing a token in the header)
// Sets req.auth_userId to the userId (token.sub)
// Sets req.auth_role to the role (token.role)
const authenticate = function (req, res, next) {
  const authHeader = req.get("Authorization") || ""
  const authHeaderParts = authHeader.split(" ")
  const token = authHeaderParts[0] === "Bearer" ? authHeaderParts[1] : null

  try {
    const payload = jwt.verify(token, secretKey)
    req.auth_userId = payload.sub
    req.auth_role = payload.role
    next()
  } catch (e) {
    return res.status(401).send({
      error: "Valid authentication token required"
    })
  }
}

// Check if a token is valid
// Gets passed the request
// Returns true if the token is valid (logged in)
// Returns false if the token is invalid or no token is provided (not logged in)
const checkToken = async function (req) {
  try {
    const authHeader = req.get("Authorization") || ""
    const authHeaderParts = authHeader.split(" ")
    const token = authHeaderParts[0] === "Bearer" ? authHeaderParts[1] : null

    const payload = jwt.verify(token, secretKey)
    return true

  } catch (e) {
    return false
  }
}

const checkAdminToken = async function (req, res) {
  const authHeader = req.get("Authorization") || ""
  const authHeaderParts = authHeader.split(" ")
  const token = authHeaderParts[0] === "Bearer" ? authHeaderParts[1] : null

  try {
    const payload = jwt.verify(token, secretKey)
    return payload.role === "admin"
  } catch (e) {
    res.status(403).send({
      error: "Valid admin authentication token required"
    })
  }
}

module.exports = { generateAuthToken, authenticate, checkToken, checkAdminToken };