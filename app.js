const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];

  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "JESUS_CHRIST", async (error, payload) => {
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

// USER REGISTRATION API
app.post("/register/", async (request, response) => {
  const userDetails = request.body;
  const { username, password, name, gender } = userDetails;
  const hashedPassword = await bcrypt.hash(password, 10);

  const selectUserQuery = `
    SELECT 
        * 
    FROM 
        user 
    WHERE
        username = "${username}"
  `;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
            INSERT INTO 
                user (username, password, name, gender) 
            VALUES(
                "${username}",
                "${hashedPassword}",
                "${name}",
                "${gender}"
            )
        `;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//USER LOGIN API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `
    SELECT 
        * 
    FROM 
        user 
    WHERE 
        username = "${username}"
  `;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "JESUS_CHRIST");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//USER TWEETS FEED API
app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
  const dbUser = await db.get(getUserQuery);

  const userId = dbUser.user_id;

  const getUserFollowingTweetsQuery = `
    SELECT 
        username, tweet, date_time AS dateTime 
    FROM
        user INNER JOIN  follower
        ON user.user_id = follower.following_user_id
        INNER JOIN tweet 
        ON tweet.user_id = follower.following_user_id
    WHERE 
        follower.follower_user_id = ${userId}
    ORDER BY
        tweet.date_time DESC 
    LIMIT ${4};
  `;
  const dbResponse = await db.all(getUserFollowingTweetsQuery);
  response.send(dbResponse);
});

//USER FOLLOWING API
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
  const dbUser = await db.get(getUserQuery);

  const userId = dbUser.user_id;

  const getUserFollowingQuery = `
    SELECT 
        name 
    FROM 
        user INNER JOIN follower 
        ON user.user_id = follower.following_user_id 
    WHERE
        follower.follower_user_id = ${userId}
  `;
  const dbResponse = await db.all(getUserFollowingQuery);
  response.send(dbResponse);
});

// USER FOLLOWERS API

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
  const dbUser = await db.get(getUserQuery);

  const userId = dbUser.user_id;

  const getUserFollowersQuery = `
    SELECT
        name 
    FROM
        user INNER JOIN follower 
        ON user.user_id = follower.follower_user_id
    WHERE
        follower.following_user_id = ${userId}
  `;
  const dbResponse = await db.all(getUserFollowersQuery);
  response.send(dbResponse);
});

//USER FOLLOWING TWEETS API
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
  const dbUser = await db.get(getUserQuery);

  const userId = dbUser.user_id;

  const getUserFollowingTweetsQuery = `
    SELECT 
        * 
    FROM
        user INNER JOIN follower 
        ON user.user_id = follower.following_user_id
        INNER JOIN tweet 
        ON tweet.user_id = follower.following_user_id
    WHERE
        follower.follower_user_id = ${userId}
  `;
  const tweetsList = [];
  const dbResponse = await db.all(getUserFollowingTweetsQuery);
  for (let obj of dbResponse) {
    tweetsList.push(obj.tweet_id);
  }

  if (tweetsList.includes(parseInt(tweetId)) === true) {
    const getUserRequestedTweetQuery = `
        SELECT 
            tweet,
            (
                SELECT 
                    COUNT(like_id)
                 FROM 
                    like 
                WHERE
                    tweet_id = tweet.tweet_id
            ) AS likes,
            (
                SELECT 
                    COUNT(reply_id)
                 FROM 
                    reply 
                WHERE
                    tweet_id = tweet.tweet_id
            ) AS replies,
            date_time AS dateTime  
        FROM 
            tweet INNER JOIN user
            ON user.user_id = tweet.user_id 
        WHERE
            tweet.tweet_id = ${tweetId}
        
    `;
    const dbResponse = await db.get(getUserRequestedTweetQuery);
    response.send(dbResponse);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//USER FOLLOWING TWEET LIKES API

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
    const dbUser = await db.get(getUserQuery);

    const userId = dbUser.user_id;

    const getUserFollowingTweetsQuery = `
    SELECT 
        * 
    FROM
        user INNER JOIN follower 
        ON user.user_id = follower.following_user_id
        INNER JOIN tweet 
        ON tweet.user_id = follower.following_user_id
    WHERE
        follower.follower_user_id = ${userId}
  `;
    const tweetsList = [];
    const dbResponse = await db.all(getUserFollowingTweetsQuery);
    for (let obj of dbResponse) {
      tweetsList.push(obj.tweet_id);
    }

    if (tweetsList.includes(parseInt(tweetId)) === true) {
      const getUserFollowingTweetLikesQuery = `
            SELECT 
                *
            FROM 
                tweet INNER JOIN like 
                ON tweet.tweet_id = like.tweet_id 
                INNER JOIN user 
                ON user.user_id = like.user_id
            WHERE
                tweet.tweet_id = ${tweetId}

        `;
      const likesUsernameList = [];
      const dbResponse = await db.all(getUserFollowingTweetLikesQuery);
      for (let obj of dbResponse) {
        likesUsernameList.push(obj.username);
      }
      response.send({ likes: likesUsernameList });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//USER FOLLOWING REPLIES API

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
    const dbUser = await db.get(getUserQuery);

    const userId = dbUser.user_id;

    const getUserFollowingTweetsQuery = `
    SELECT 
        * 
    FROM
        user INNER JOIN follower 
        ON user.user_id = follower.following_user_id
        INNER JOIN tweet 
        ON tweet.user_id = follower.following_user_id
    WHERE
        follower.follower_user_id = ${userId}
  `;
    const tweetsList = [];
    const dbResponse = await db.all(getUserFollowingTweetsQuery);
    for (let obj of dbResponse) {
      tweetsList.push(obj.tweet_id);
    }

    if (tweetsList.includes(parseInt(tweetId)) === true) {
      const getUserFollowingRepliesQuery = `
            SELECT
                name,
                reply
            FROM 
                tweet INNER JOIN reply 
                ON tweet.tweet_id = reply.tweet_id 
                INNER JOIN user 
                ON user.user_id = reply.user_id 
            WHERE
                tweet.tweet_id = ${tweetId}
        `;
      const repliesUsernameList = [];
      const dbResponse = await db.all(getUserFollowingRepliesQuery);
      for (let obj of dbResponse) {
        repliesUsernameList.push(obj);
      }
      response.send({ replies: repliesUsernameList });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//USER TWEETS API

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
  const dbUser = await db.get(getUserQuery);

  const userId = dbUser.user_id;
  const getUserTweetsQuery = `
    SELECT 
        tweet,
        (
            SELECT COUNT(like_id)
            FROM like
            WHERE tweet_id=tweet.tweet_id
        ) AS likes,
        (
            SELECT COUNT(reply_id)
            FROM reply
            WHERE tweet_id=tweet.tweet_id  
        ) AS replies,
        date_time AS dateTime
    FROM tweet
   WHERE user_id= ${userId}
   `;
  const dbResponse = await db.all(getUserTweetsQuery);
  response.send(dbResponse);
});

//USER CREATE TWEET API
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const tweetDetails = request.body;
  const { tweet } = tweetDetails;

  const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
  const dbUser = await db.get(getUserQuery);

  const userId = dbUser.user_id;

  const now = new Date();
  const date =
    now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
  const time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();

  const dateTime = date + " " + time;

  const createUserTweetQuery = `
      INSERT INTO
          tweet (tweet, user_id, date_time)
      VALUES(
          "${tweet}",
          ${userId},
          "${dateTime}"
      )
    `;
  await db.run(createUserTweetQuery);
  response.send("Created a Tweet");
});

//USER DELETE TWEET API
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getUserQuery = `
    SELECT 
        * 
    FROM
        user
    WHERE
        username = "${username}"
  `;
    const dbUser = await db.get(getUserQuery);

    const userId = dbUser.user_id;

    const getUserFollowingTweetsQuery = `
    SELECT 
        * 
    FROM
        user INNER JOIN tweet 
        ON user.user_id = tweet.user_id
    WHERE
        user.user_id = ${userId}
  `;
    const tweetsList = [];
    const dbResponse = await db.all(getUserFollowingTweetsQuery);
    for (let obj of dbResponse) {
      tweetsList.push(obj.tweet_id);
    }

    if (tweetsList.includes(parseInt(tweetId))) {
      const deleteUserTweetQuery = `
        DELETE FROM 
            tweet 
        WHERE
            tweet.tweet_id = ${tweetId}
      `;
      await db.run(deleteUserTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
module.exports = app;
