const express = require("express");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "twitterClone.db");
let bd = null;

const initializingDbAndConnectingToServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is Running At http://localhost:3000");
    });
  } catch (error) {
    console.log(`ErrorDb ${error.message}`);
    process.exit(1);
  }
};
initializingDbAndConnectingToServer();

//API for registering user

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length >= 6) {
      const hashedPassword = await bcrypt.hash(request.body.password, 10);
      const registerUserQuery = `INSERT INTO user(name,username,password,gender)
       VALUES ('${name}','${username}','${hashedPassword}','${gender}');`;
      const postUser = await db.run(registerUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  }
});

//API for login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MSD");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let autToken;
  const headers = request.headers["authorization"];
  if (headers !== undefined) {
    autToken = headers.split(" ")[1];
  }
  if (autToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(autToken, "MSD", async (error, payload) => {
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

//API for getting tweets
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const userDetailsQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(userDetailsQuery);
  const userId = dbUser.user_id;
  const getTweetsQuery = `SELECT user.username,tweet.tweet,tweet.date_time AS dateTime
   FROM tweet INNER JOIN user ON tweet.user_id=user.user_id
   WHERE tweet.user_id IN (SELECT following_user_id FROM follower WHERE follower_user_id=${userId})
   ORDER BY date_time DESC LIMIT 4; `;
  const tweetsDetails = await db.all(getTweetsQuery);
  response.send(tweetsDetails);
});

//API for user following
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(getUserIdQuery);
  const userFollowingQuery = `SELECT user.name
   FROM follower INNER JOIN user ON follower.following_user_id=user.user_id
   WHERE follower.follower_user_id=${userDetails.user_id}`;
  const userFollowingNames = await db.all(userFollowingQuery);
  response.send(userFollowingNames);
});

//API for user followers
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(getUserIdQuery);
  const userFollowersDetailsQuery = `SELECT user.name FROM follower
   INNER JOIN user ON follower.follower_user_id=user.user_id 
   WHERE follower.following_user_id=${userDetails.user_id};`;
  const userFollowersNames = await db.all(userFollowersDetailsQuery);
  response.send(userFollowersNames);
});

function foo(obj) {
  return obj.username;
}
function foo1(obj) {
  return obj.tweet_id;
}

const followerOrNot = async (request, response, next) => {
  let { username } = request;
  const { tweetId } = request.params;
  const getUserIdQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(getUserIdQuery);
  const userId = userDetails.user_id;
  const userFollowingTweetsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (SELECT following_user_id FROM follower WHERE follower_user_id=${userId});`;
  const userFollowingTweets = await db.all(userFollowingTweetsQuery);
  const tweetIds = userFollowingTweets.map(foo1);
  if (tweetIds.includes(tweetId) === true) {
    request.tweetId = tweetId;
    next();
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
};

//API get the tweet of the user following
app.get(
  "/tweets/:tweetId",
  authenticateToken,
  followerOrNot,
  async (request, response) => {
    const { tweetId } = request.params;
    const tweetQuery = `SELECT tweet.tweet,COUNT(like.tweet_id) AS likes,(SELECT COUNT() FROM reply WHERE tweet_id=${tweetId}) AS replies,tweet.date_time AS dateTime
    FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id WHERE tweet.tweet_id=${tweetId};`;
    const tweetDetails = await db.get(tweetQuery);
    response.send(tweetDetails[0]);
  }
);

//API for list of names liked the tweet

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  followerOrNot,
  async (request, response) => {
    const { tweetId } = request.params;
    const tweetDetailsQuery = `SELECT user.username FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id
    INNER JOIN user ON like.user_id=user.user_id
    WHERE tweet.tweet_id=${tweetId};`;
    const tweetLikersUsernames = await db.all(tweetDetailsQuery);
    const arrayOfUsernames = tweetLikersUsernames.map(foo);
    const objResponse = { likes: arrayOfUsernames };
    response.send(objResponse);
  }
);

//API for array of replies
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  followerOrNot,
  async (request, response) => {
    const { tweetId } = request.params;
    const repliesQuery = `SELECT user.name,reply.reply FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id
     INNER JOIN user ON user.user_id=reply.user_id WHERE tweet.tweet_id=${tweetId}`;
    const dbResponse = await db.all(repliesQuery);
    const sendResponse = { replies: dbResponse };
    response.send(sendResponse);
  }
);

//API for getting user tweets
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserQuery = `SELECT * FROM user WHERE user.username='${username}';`;
  const userDetails = await db.get(getUserQuery);
  const userId = userDetails.user_id;
  const tweetsQuery = `SELECT tweet.tweet,COUNT(like.tweet_id) AS likes,(SELECT count() FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id WHERE tweet.user_id=${userId} GROUP BY tweet.tweet_id) AS replies,tweet.date_time AS dateTime
  FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id WHERE tweet.user_id=${userId} GROUP BY tweet.tweet_id;`;
  const tweetsDetails = await db.all(tweetsQuery);
  response.send(tweetsDetails);
});

//API FOR POSTING TWEETS
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const { tweet } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE user.username='${username}';`;
  const dbResponse = await db.get(getUserQuery);
  const postTweetQuery = `INSERT INTO tweet(tweet) VALUES ('${tweet}');`;
  const postTweet = await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

//API for deleting a tweet
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const getUserQuery = `SELECT * FROM user WHERE user.username='${username}';`;
    const dbResponse = await db.get(getUserQuery);
    const userId = dbResponse.user_id;
    const tweetQuery = `SELECT * FROM tweet WHERE tweet.tweet_id=${tweetId};`;
    const dbTweets = await db.get(tweetQuery);
    const tweetOwner = dbTweets.user_id;
    if (userId === tweetOwner) {
      const deleteQuery = `DELETE FROM tweet WHERE tweet.tweet_id=${tweetId};`;
      const deleteResult = await db.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
module.exports = app;

app.get("/users/:userId", async (request, response) => {
  const { userId } = request.params;
  const query = `SELECT * FROM user WHERE user_id=${userId};`;
  const result = await db.all(query);
  response.send(result);
});
