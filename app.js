const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
console.log({ bcrypt });
app.use(express.json());
let db = null;
const initializationDbServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, "twitterClone.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error is ${e.message}`);
    process.exit(1);
  }
};

initializationDbServer();

// API 1
app.post("/register/", async (request, response) => {
  let data = null;
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  //   console.log({ hashedPassword });
  const sqlQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  data = await db.get(sqlQuery);
  let postQuery = "";
  if (data === undefined) {
    if (password.length > 6) {
      postQuery = `
        INSERT INTO user 
        (username, password, name, gender)
         VALUES ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
      data = await db.run(postQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const sqlQuery = `SELECT * FROM user WHERE username = '${username}';`;
  data = await db.get(sqlQuery);
  if (data === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPassIsMatched = await bcrypt.compare(password, data.password);

    if (isPassIsMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// authentication .......
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
// checking authentication working or not
// app.get("/users/", authentication, async (request, response) => {
//   const sqlQuery = `
//     SELECT * FROM user;`;
//   data = await db.all(sqlQuery);
//   response.send(data);
// });
// API 3

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const sqlQuery = `
    SELECT username, tweet, 
    date_time AS dateTime 
    FROM user NATURAL JOIN tweet
    GROUP BY username
    ORDER BY date_time ASC
    LIMIT 4;`;
  data = await db.all(sqlQuery);
  response.send(data);
});

// API 4
app.get("/user/following/", authentication, async (request, response) => {
  const sqlQuery = `
    SELECT name FROM user WHERE;`;
  data = await db.all(sqlQuery);
  response.send(data);
});

// API 5
app.get("/user/followers/", authentication, async (request, response) => {
  const sqlQuery = `
    SELECT name FROM user;`;
  data = await db.all(sqlQuery);
  response.send(data);
});
// API 6

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  let sqlQuery;
  const getQuery = `SELECT tweet, count(like.like_id) AS likes, date_time AS dateTime
   FROM tweet
   NATURAL JOIN like  WHERE tweet_id = ${tweetId};`;
  data = await db.get(getQuery);
  if (data === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    sqlQuery = `
         SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
    data = await db.get(sqlQuery);
    response.send(data);
  }
});

// API 7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const sqlQuery = ` SELECT COUNT(like) FROM `;
  }
);

// API 8

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweedId } = request.params;
  }
);
// API 9

app.get("/user/tweets/", authentication, async (request, response) => {
  // const {username} = request.body;
  const sqlQuery = `
    SELECT * FROM tweet ;`;
  data = await db.all(sqlQuery);
  response.send(data);
});

// API 10

app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const sqlQuery = ` INSERT INTO tweet (tweet) VALUES ('${tweet}');`;
  await db.run(sqlQuery);
  response.send("Created a Tweet");
});
// API 11

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  let sqlQuery;
  const deleteQuery = ` SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
  data = await db.get(deleteQuery);
  if (data === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    sqlQuery = ` DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
    await db.run(sqlQuery);
    response.send("Tweet Removed");
  }
});

module.exports = app;
