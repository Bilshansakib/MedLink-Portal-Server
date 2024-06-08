const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 9000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7hlvjai.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("medicalcampDb").collection("users");
    const reviewCollection = client.db("medicalcampDb").collection("reviews");
    const campsCollection = client.db("medicalcampDb").collection("camps");
    const registeredCollection = client
      .db("medicalcampDb")
      .collection("registered");
    const participatorCollection = client
      .db("medicalcampDb")
      .collection("participator");

    const paymentCollection = client.db("medicalcampDb").collection("payments");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin -----> after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // Get user role
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // user exist checking
      const query = { email: user.email };
      const isExistingUser = await userCollection.findOne(query);

      if (isExistingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    //  for admin making call
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // camps related api
    app.get("/camps", async (req, res) => {
      const result = await campsCollection.find().toArray();
      res.send(result);
    });
    // add a camp
    app.post("/camps", async (req, res) => {
      const campaign = req.body;
      const result = await campsCollection.insertOne(campaign);
      res.send(result);
    });

    app.delete("/camps/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campsCollection.deleteOne(query);
      res.send(result);
    });
    // manage camp (get update id)
    app.get("/camps/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campsCollection.findOne(query);
      res.send(result);
    });
    // manage camp (update data)
    app.put("/camps/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          CampName: data.CampName,
          Image: data.Image,
          CampFees: parseFloat(data.CampFees),
          DateTime: data.DateTime,

          HealthcareProfessional: data.HealthcareProfessional,
          ParticipantCount: data.ParticipantCount,
          Description: data.Description,
          Location: data.Location,
        },
      };
      const result = await campsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // participator api
    app.post("/participator", async (req, res) => {
      const participator = req.body;
      const result = await participatorCollection.insertOne(participator);
      res.send(result);
    });

    app.get("/participator", async (req, res) => {
      const result = await participatorCollection.find().toArray();
      res.send(result);
    });
    app.get("/participator/:email", async (req, res) => {
      // const query = { email: req.params.email };
      const email = req.params.email;
      const query = { "Participator.email": email };
      console.log(query);

      const result = await participatorCollection.find(query).toArray();
      res.send(result);
      console.log(result);
    });
    // ------.......>...

    app.post("/registered", async (req, res) => {
      const participator = req.body;
      const updateDoc = {
        $inc: {
          ParticipantCount: 1,
          Participant_Count: 1,
        },
      };
      const result = await registeredCollection.insertOne(
        participator,
        updateDoc
      );
      res.send(result);
    });
    app.get("/registered", async (req, res) => {
      const result = await registeredCollection.find().toArray();
      res.send(result);
    });
    app.get("/registered/:email", async (req, res) => {
      // const query = { email: req.params.email };
      const email = req.params.email;
      const query = { "Participator.email": email };
      const regCount = req.body;

      console.log(query);
      const result = await registeredCollection.find(query).toArray();
      res.send(result);
      console.log(result);
    });
    app.delete("/registered/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await registeredCollection.deleteOne(query);
      res.send(result);
    });
    // ---------
    app.delete("/participator/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await participatorCollection.deleteOne(query);
      res.send(result);
    });
    // .............>>>>payment
    app.post("/create-payment-intent", async (req, res) => {
      const { CampFees } = req.body;
      const { CampName } = req.body;
      const amount = parseInt(CampFees * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        CampName: CampName,
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(CampName);

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // app.post("/payments", async (req, res) => {
    //   const payment = req.body;
    //   const paymentResult = await paymentsCollection.insertOne(payment);

    //   console.log("payment info", payment);
    //   // delete
    //   const query = {
    //     _id: {
    //       $in: payment.campIds.map((id) => new ObjectId(id)),
    //     },
    //   };
    //   const deleteResult = await paymentsCollection.deleteMany(query);
    //   res.send({ paymentResult, deleteResult });
    //   console.log(paymentResult);
    // });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.campIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await paymentCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    // states for
    app.get("/stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const registered = await registeredCollection.estimatedDocumentCount();

      // revenue call
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$CampFees",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({ users, registered, revenue });
      console.log({ users, registered, revenue });
    });

    // participators
    app.get("/register-stats", async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$registeredCampIds",
          },
          {
            $lookup: {
              from: "camps",
              localField: "registeredCampIds",
              foreignField: "_id",
              as: "Items",
            },
          },
          // {
          //   $unwind: "$Items",
          // },
          // {
          //   $group: {
          //     _id: "$Items.CampName",
          //     quantity: { $sum: 1 },
          //     revenue: { $sum: "$Items.CampFees" },
          //   },
          // },
          // {
          //   $project: {
          //     _id: 0,
          //     category: "$_id",
          //     quantity: "$quantity",
          //     revenue: "$revenue",
          //   },
          // },
        ])
        .toArray();
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from medical camp Server..");
});

app.listen(port, () => {
  console.log(`medical camp is running on port the ${port}`);
});
