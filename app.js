const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();

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
        request.username = payload.username;
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
  let { username } = request;
  const sqlQuery = `
    SELECT username, tweet, 
    date_time AS dateTime 
    FROM user NATURAL JOIN tweet 
    natural join follower where follower_user_id = ${2}
    group by tweet
    order by username
    limit 4
    offset 5
    ;`;
  data = await db.all(sqlQuery);
  response.send(data);
});

// API 4
app.get("/user/following/", authentication, async (request, response) => {
  let { username } = request;
  const selectQuery = ` select * from user where username = '${username}';`;
  data = await db.get(selectQuery);
  const sqlQuery = `
      SELECT name FROM user join follower WHERE following_user_id = ${data.user_id};`;

  data = await db.all(sqlQuery);
  response.send(data);
});

// API 5
app.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request;

  const selectQuery = ` select * from user where username = '${username}';`;
  data = await db.get(selectQuery);
  const sqlQuery = `
      SELECT name FROM user join follower WHERE follower_user_id = ${data.user_id};`;

  data = await db.all(sqlQuery);
  response.send(data);
});
// API 6

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  let sqlQuery;
  const getQuery = `SELECT *
   FROM tweet
  WHERE tweet_id = ${tweetId};`;
  data = await db.get(getQuery);
  if (data === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    sqlQuery = `
         SELECT tweet, count(like.like_id) AS likes, count(reply_id) as replies,
          date_time AS dateTime FROM tweet join like join reply WHERE like.user_id = ${2} and reply.user_id = ${2} and tweet.tweet_id = ${tweetId};`;
    data = await db.get(sqlQuery);
    response.send(data);
  }
});

// API 7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    let getQuery;
    let { username } = request;
    const { tweetId } = request.params;
    const sqlQuery = ` SELECT * FROM user join follower 
    where user_id and following_user_id = ${2}
    ;`;
    data = await db.get(sqlQuery);
    if (data === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      if (data === true) {
        getQuery = ` select name as likes from user join like where user_id = ${2};`;
        data = await db.get(getQuery);
        response.send(data);
      }
    }
  }
);

// API 8

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    let replyQuery;
    const sqlQuery = ` select * from tweet inner join user on tweet.user_id = user.user_id
    where tweet_id = ${tweetId} and user.username = '${username}';`;
    data = await db.get(sqlQuery);
    if (data === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      if (data.username === username) {
        replyQuery = `
          select name , reply from user 
          inner join reply on user.user_id = reply.user_id
          inner join tweet on user.user_id = tweet.user_id 
          where tweet.tweet_id = ${tweetId};`;
        const replies = await db.all(replyQuery);
        response.send({ replies });
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    }
  }
);
// API 9

app.get("/user/tweets/", authentication, async (request, response) => {
  let { username } = request;
  const sqlQuery = `
    SELECT tweet, 
    count(like_id) as likes, 
    count(reply_id) as replies,
    date_time as dateTime
    from tweet natural join user 
    inner join like on tweet.user_id = like.user_id
    inner join reply on tweet.user_id = reply.user_id 
    where username = '${username}' and like.user_id = ${2} and reply.user_id = ${2}
    group by tweet;`;
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
  let { username } = request;
  const { tweetId } = request.params;
  const selectQuery = ` select * from user where username = '${username}';`;
  data = await db.get(selectQuery);
  let deleteQuery;
  const sqlQuery = `
  select * from tweet where  tweet.user_id = ${data.user_id} and tweet_id = ${tweetId};`;
  let result = await db.get(sqlQuery);
  if (result === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    if (result.user_id === data.user_id) {
      deleteQuery = `delete from tweet where tweet_id = ${tweetId};`;
      await db.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
  response.send(result);
});

module.exports = app;
