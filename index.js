const express = require('express')
const { open } = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())

const dbPath = path.join(__dirname, 'twitterClone.db')

const initializeDBAndServer = async () => {
    try {
        db = await open({ filename: dbPath, driver: sqlite3.Database })

        app.listen(3000, () => {
            console.log('Ther server is started at http://localhost:3000/')
        })
    } catch (e) {
        console.log(`Error : ${e.message}`)
        process.exit(1)
    }
}

initializeDBAndServer()

const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];

    if (authHeader) {
        jwtToken = authHeader.split(" ")[1]

        jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
            if (error) {
                response.status(400)
                response.send("Invalid JWT Token")
            }
            else {
                request.username = payload.username
                next();
            }
        })
    }
    else {
        response.status(400)
        response.send("Invalid JWT Token")
    }
};


// API 1
app.post('/register/', async (request, response) => {
    const { username, password, name, gender } = request.body

    const userDetailsQuery = `
    SELECT
    * FROM 
    user
    WHERE
    username = '${username}';`
    const userDetails = await db.get(userDetailsQuery)
    if (userDetails === undefined) {
        // console.log('if block')
        if (password.length < 6) {
            // response.status(400)
            response.send('Password is too short')
            process.exit(1)
        }
        const hashedPassword = bcrypt.hash(password, 10)

        const addUserQuery = `
    INSERT INTO user
    (name, username, password, gender)
     values(
      '${name}',
      '${username}',
      '${hashedPassword}',
      '${gender}');
    `

        await db.run(addUserQuery)
        response.status(200)
        response.send('User created successfully')
    } else {
        response.status(400)
        response.send('User already exists')
    }
})

// API 2
app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const existUserQuery = `select * from user where username = '${username}';`

    const existingUser = await db.get(existUserQuery)

    if (existingUser) {
        console.log(existingUser.user_id)
        const passwordMatch = await bcrypt.compare(password, existingUser.password)

        if (passwordMatch) {
            console.log("Login successfull")

            const payload = { username: username }
            const jwtToken = jwt.sign(payload, "MY_SECRET_KEY")
            response.send({ jwtToken: jwtToken })

        }
        else {
            console.log("Invalid password")
            response.status(400)
            response.send("Invalid password")
        }

    }
    else {
        response.status(400)
        response.send("Invalid user")
    }
});


// API 3
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
    const username = request.username
    const userId = await getUserId(username)

    //Query to get the latest tweets
    const tweetQuery =
        `
    SELECT u.username, t.tweet, t.date_time
    FROM
    tweet t, user u
    WHERE
    u.user_id = t.user_id
    AND
    t.user_id in
    (SELECT 
    following_user_id 
    FROM
    follower 
    WHERE
    follower_user_id = ${userId})
    ORDER BY t.date_time DESC LIMIT 4;
    `
    const tweets = await db.all(tweetQuery)
    response.send(tweets)
})

// API 4
app.get('/user/following/', authenticateToken, async (request, response) => {

    const username = request.username
    //Get the user_id of the user
    const user_id = await getUserId(username)

    //Query to get the list of follws
    const query = `
        select u.name 
        from 
        user u, follower f
        where
        f.following_user_id = u.user_id and
        f.follower_user_id = ${user_id}; `
    const followsList = await db.all(query)
    response.send(followsList)

})


const getUserId = async (username) => {
    const user_id = await db.get(`select user_id from user where username = '${username}';`)
        .then((user) => { return user.user_id })
    return user_id
}

app.get('/', authenticateToken, (request, response) => {

    console.log(request.username)
    response.send("authenticated")
})