const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

// Middleware
const corsOption = {
  origin: [
    "http://localhost:5173",
    "https://a11-helphive.web.app",
    "https://a11-helphive.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOption));
app.use(express.json());
app.use(cookieParser());

// verify jwt middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "Unauthorized access" });
      }
      console.log(decoded);

      req.user = decoded;
      next();
    });
  }
};

// MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gjqtths.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const postCollection = client.db("helphiveDB").collection("posts");
    const requestCollection = client.db("helphiveDB").collection("requests");

    // jwt generate
    // app.post("/jwt", async (req, res) => {
    //   const email = req.body;
    //   const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
    //     expiresIn: "1d",
    //   });
    //   res
    //     .cookie("token", token, {
    //       httpOnly: true,
    //       secure: process.env.NODE_ENV === "production",
    //       sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    //     })
    //     .send({ success: true });
    // });

    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "365d",
        });
        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({
            status: true,
          });
      } catch (error) {
        res.send({
          status: true,
          error: error.message,
        });
      }
    });

    // Clear token on logout
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });
    // app.post("/logout", async (req, res) => {
    //   const user = req.body;
    //   res
    //     .clearCookie("token", {
    //       maxAge: 0,
    //       secure: process.env.NODE_ENV === "production" ? true : false,
    //       sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    //     })
    //     .send({ status: true });
    // });

    // Save data in posts collection
    app.post("/posts", async (req, res) => {
      const postData = req.body;
      const result = await postCollection.insertOne(postData);
      res.send(result);
    });

    // Save data in request collection
    app.post("/requests", async (req, res) => {
      const requestData = req.body;
      const query = {
        email: requestData.email,
        requestId: requestData.requestId,
      };
      const alreadyApplied = await requestCollection.findOne(query);
      if (alreadyApplied) {
        return res.status(400).send("You have already requested on this post!");
      }

      const result = await requestCollection.insertOne(requestData);
      // Update volunteer needed amount in posts collection
      const updatedPost = {
        $inc: { volunteers_needed: -1 },
      };
      const postQuery = { _id: new ObjectId(requestData.requestId) };
      const updateVolunteer = await postCollection.updateOne(
        postQuery,
        updatedPost
      );
      console.log(updateVolunteer);
      res.send(result);
    });

    // Get data from requests Collection
    app.get("/requests", async (req, res) => {
      const result = await requestCollection.find().toArray();
      res.send(result);
    });

    // Get data from Database
    app.get("/posts", async (req, res) => {
      const search = req.query.search;
      let query;
      if (search) {
        query = {
          post_title: { $regex: `${search}`, $options: "i" },
        };
      } else {
        query = {};
      }
      const result = await postCollection
        .find(query)
        .sort({ deadline: 1 })
        .toArray();
      res.send(result);
    });

    // Get specific post data
    app.get("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    // Get specific user posted data
    app.get("/post/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      console.log(tokenEmail);
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { organizerEmail: email };
      const result = await postCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/requests/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { volunteerEmail: email };
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });

    // Delete a data
    app.delete("/post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.deleteOne(query);
      res.send(result);
    });
    // Delete a request
    app.delete("/request/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.deleteOne(query);
      res.send(result);
    });

    // Update a data
    app.put("/posts/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const postData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...postData,
        },
      };
      const result = await postCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("HelpHive Server is running...");
});

app.listen(port, () => console.log(`Server running on port: ${port}`));
