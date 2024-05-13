const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

// Middleware
const corsOption = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOption));
app.use(express.json());

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

    // Save data in posts collection
    app.post("/posts", async (req, res) => {
      const postData = req.body;
      const result = await postCollection.insertOne(postData);
      res.send(result);
    });

    // Save data in request collection
    app.post("/requests", async (req, res) => {
      const requestData = req.body;
      const result = await requestCollection.insertOne(requestData);
      res.send(result);
    });

    // Get data from requests Collection
    app.get("/requests", async (req, res) => {
      const result = await requestCollection.find().toArray();
      res.send(result);
    });

    // Get data from Database
    app.get("/posts", async (req, res) => {
      const result = await postCollection.find().toArray();
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
    app.get("/post/:email", async (req, res) => {
      const email = req.params.email;
      const query = { organizerEmail: email };
      const result = await postCollection.find(query).toArray();
      res.send(result);
    });

    // Delete a data
    app.delete("/post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.deleteOne(query);
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
