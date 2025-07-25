import bcrypt from 'bcryptjs'
import { MongoClient } from 'mongodb'

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, message: 'Method not allowed' }),
    }
  }

  try {
    const { email, password } = JSON.parse(event.body)

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Email and password are required',
        }),
      }
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Password must be at least 6 characters long',
        }),
      }
    }

    const client = new MongoClient(process.env.MONGO_URI)

    try {
      await client.connect()
      const db = client.db('gallery')
      const users = db.collection('users')

      // Check if user already exists
      const existingUser = await users.findOne({ email: email.toLowerCase() })

      if (existingUser) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Email is already in use',
          }),
        }
      }

      // Hash password
      const saltRounds = 12
      const hashedPassword = await bcrypt.hash(password, saltRounds)

      // Create user
      const newUser = {
        email: email.toLowerCase(),
        password: hashedPassword,
        isApproved: false, // Requires manual approval
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await users.insertOne(newUser)

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            _id: result.insertedId,
            email: newUser.email,
            isApproved: newUser.isApproved,
            createdAt: newUser.createdAt,
          },
        }),
      }
    } finally {
      await client.close()
    }
  } catch (error) {
    console.error('Register error:', error)

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Server error',
      }),
    }
  }
}
