const express = require("express");
const router = express.Router();
const User = require("../models/user");
const userTasks = require("../models/userTasks");
const Tasks = require("../models/tasks");
const Admin = require("../models/admin");
const Verification = require("../models/verification");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const id = "1_s_E11Xn4DqW0BQ4lttvRzCcnc-PORbOrlSIWKnkv9k";

const isAuthenticated = (req, res, next) => {
  if(!req.session.userId){
    res.redirect("/login")
  } else {
    next()
  }
}

router.get("/", (req, res, next) => {
  return res.render("index.ejs")
})

router.get("/tasks", (req, res, next) => {
  res.render("tasks.ejs")
})

router.get("/signup", (req, res, next) => {
  return res.render("signup.ejs");
});

router.post("/signup", async (req, res, next) => {
  let personInfo = req.body;

  if (
    !personInfo.email ||
    !personInfo.username ||
    !personInfo.password ||
    !personInfo.passwordConf
  ) {
    res.send();
  } else {
    if (personInfo.password == personInfo.passwordConf) {
      User.findOne({ email: personInfo.email }, (err, data) => {
        if (!data) {
          let c;
          User.findOne({}, (err, data) => {
            if (data) {
              c = data.unique_id + 1;
            } else {
              c = 1;
            }

            let verification_link = uuid();
            let bits_id = com_id();

            let newPerson = new User({
              unique_id: c,
              email: personInfo.email,
              username: personInfo.username,
              school: personInfo.school,
              fullname: personInfo.fullname,
              age: personInfo.age,
              competitor_id: "bits22-" + bits_id,
              password: personInfo.password,
              passwordConf: personInfo.passwordConf,
              verified: false,
              adminUser: false
            });

            let newVerification = new Verification({
              unique_id: c,
              verification_link: verification_link,
              verified: false,
            });

            let newUserTasks = new userTasks({
              user_id: c,
              choosed_tasks: [],
              pending_tasks: [],
              approved_tasks: [],
              declined_tasks: []
            });

            newUserTasks.save((err, Data) => {
              if(err) {
                console.log(err);
              } else {
                console.log("Successfully added records for user tasks")
              }
            })

            newVerification.save((err, Data) => {
              if (err) {
                console.log(err);
              } else {
                console.log("Sucessfully added verification");
              }
            });

            (async () => {
              try {
                const { sheets } = await authentication();
                const { fullname, email, school, age } = req.body;

                const writeReq = await sheets.spreadsheets.values.append({
                  spreadsheetId: id,
                  range: "Sheet1",
                  valueInputOption: "USER_ENTERED",
                  resource: {
                    values: [
                      [fullname, email, age, school, "bits22-" + bits_id],
                    ],
                  },
                });

                if (writeReq.status === 200) {
                  console.log("Spreadsheet updated");
                } else {
                  console.log(
                    "Somethign went wrong while updating the spreadsheet."
                  );
                }
              } catch (e) {
                console.log("ERROR WHILE UPDATING THE SPREADSHEET", e);
              }
            })();

            newPerson.save((err, Person) => {
              if (err) console.log(err);
              else {
                async function main() {
                  let transporter = nodemailer.createTransport({
                    host: "smtp.mail.yahoo.com",
                    port: 465,
                    secure: true,
                    auth: {
                      user: "pasindudushan07@yahoo.com",
                      pass: "sjrbeghvrlhorwnn",
                    },
                  });

                  let info = await transporter.sendMail({
                    from: '"BITS 22" <pasindudushan07@yahoo.com>',
                    to: personInfo.email,
                    subject: `Welcome ${personInfo.username}`,
                    html: `<p>Hello there, Welcome to BITS'22 organized by ACICTS of Ananda College Colombo. Please verify all information below before continuing, If there are any issues please contact one of our site admins immediately. If everything is correct please click below link to verify your email</b><br><br><b>Information Provided</b><ul><li>Username: ${personInfo.username}</li><li>School Name: ${personInfo.school}</li><li>Email: ${personInfo.email}</li><li>Password: ********</li><li>BITS ID: bits22-${bits_id}</li></ul><br><b>Confirmation Link - http://localhost:3000/verification/${verification_link}`, // plain text body
                  });

                  console.log("Message sent: %s", info.messageId);
                }
                main().catch(console.error);
              }
            });
          })
            .sort({ _id: -1 })
            .limit(1);
          res.send({ Success: "You are regestered,You can login now." });
        } else {
          res.send({ Success: "Email is already used." });
        }
      });
    } else {
      res.send({ Success: "password is not matched" });
    }
  }
});

router.get("/task/:id", (req, res, next) => {
   Tasks.findOne({ task_id: req.params.id }, (err, data) => {
    if(!data){
      res.send("No task was found with the given ID")
    } else {
      res.render("tasks", {
        id: data.task_id,
        title: data.task_title,
        description: data.task_description
      })
    }
   })
})

router.post("/task/choose/:id", isAuthenticated,async(req, res, next) => {
  const task = await Tasks.findOne({ task_id: req.params.id });
  if(!task){
    res.sendStatus(404)
  } else {
    const taskData = await Tasks.findOne({ task_id: req.params.id })
    userTasks.findOne({ user_id: req.session.userId })
      .then((task) => {
        task.choosed_tasks.push({ task_title: taskData.task_title, task_description: taskData.task_description, task_id: taskData.task_id, task_category: taskData.task_category });
        task
          .save()
          .then(() => {
            return "Success"
          })
          .catch(console.log)
      })
      .catch(console.log)

    res.redirect('/profile')
  }
})

router.get("/verification/:id", (req, res, next) => {
  Verification.findOne({ verification_link: req.params.id }, (err, data) => {
    if (!data.verified) {
      data.verified = true;

      data.save((err, Person) => {
        if (err) console.log(err);
        else res.send("This email is successfully verified");
      });

      User.findOne({ unique_id: data.unique_id }, (err, Person) => {
        Person.verified = true;

        Person.save((err, Person) => {
          if (err) console.log(err);
        });
      });
    } else {
      res.send("This email is already verified");
    }
  });
});

router.get("/login", (req, res, next) => {
  return res.render("login.ejs");
});

router.post("/login", (req, res, next) => {
  User.findOne({ email: req.body.email }, (err, data) => {
    if (data) {
      if (data.password == req.body.password) {
        req.session.userId = data.unique_id;
        res.send({ Success: "Success!" });
      } else {
        res.send({ Success: "Wrong email or password!" });
      }
    } else {
      res.send({ Success: "This Email Is not regestered!" });
    }
  });
});

router.get("/profile", isAuthenticated, async(req, res, next) => {    
  const taskData = await userTasks.findOne({ user_id: req.session.userId })
  const userData = await User.findOne({ unique_id: req.session.userId })
  var choosedTasksArray = taskData.choosed_tasks
  var approvedTasksArray = taskData.approved_tasks
  var declinedTasksArray = taskData.declined_tasks
  var pendingTasksArray = taskData.pending_tasks

  const choosedResults = choosedTasksArray.map(function(data) {
    return { "task_title": data.task_title, "task_description": data.task_description, task_id: data.task_id, task_category: data.task_category }
  });

  const approvedResults = approvedTasksArray.map(function(data) {
    return { "task_title": data.task_title, "task_description": data.task_description, task_id: data.task_id, task_category: data.task_category }
  });

  const declinedResults = declinedTasksArray.map(function(data) {
    return { "task_title": data.task_title, "task_description": data.task_description, task_id: data.task_id, task_category: data.task_category }
  });

  const pendingResults = pendingTasksArray.map(function(data) {
    return { "task_title": data.task_title, "task_description": data.task_description, task_id: data.task_id, task_category: data.task_category }
  });

  res.render('data', {
    choosedResults: choosedResults,
    approvedResults: approvedResults,
    declinedResults: declinedResults,
    pendingResults: pendingResults
  })
});

router.get("/admin", isAuthenticated, async(req, res, next) => {
  const userData = await User.findOne({ unique_id: req.session.userId })

  if(userData.adminUser){
    res.render('admin')
  } else {
    res.send("This is a restricted area. Please do not try to access this page.")
  }
})

router.post("/task/submit/:id", isAuthenticated, async(req, res, next) => {
  const userData = await userTasks.findOne({user_id: req.session.userId});
  if(!userData){
    return res.send("User does not exists in the database")
  } else {
    const taskData = await userTasks.findOne({ user_id: req.session.userId })
    const task_dat = await Tasks.findOne({ task_id: req.params.id })
    const user = await User.findOne({ unique_id: req.session.userId })

    var choosedTasksArray = taskData.choosed_tasks
    var pendingTasksArray = taskData.pending_tasks

    const choosedResults = choosedTasksArray.map(function(data) {
        return { "id": data._id, "task_title": data.task_title, "task_description": data.task_description, task_id: data.task_id, task_category: data.task_category }
    });

    userTasks.findOne({ user_id: req.session.userId })
      .then((task) => {
        task.pending_tasks.push({ task_title: task_dat.task_title, task_description: task_dat.task_description, task_id: task_dat.task_id, task_category: task_dat.task_category });
        task
          .save()
          .then(() => {
            return "Success"
          })
          .catch(console.log)
      })
    .catch(console.log)
    Admin.findOne({ number: 1 })
    .then((task) => {
      task.taskData.push({ username: user.username, userId: user.unique_id, task_title: task_dat.task_title, task_description: task_dat.task_description, task_id: task_dat.task_id, task_category: task_dat.task_category });
      task
        .save()
        .then(() => {
          return "Success"
        })
        .catch(console.log)
    })
    .catch(console.log)

    await userTasks.update({_id: taskData._id}, {$pull: { choosed_tasks: {_id: choosedResults[0].id}}});

    res.sendStatus(200)

    // console.log(taskData._id)

    // console.log(choosedResults[0].id)
  }
})

router.get("/logout", (req, res, next) => {
  if (req.session) {
    // delete session object
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      } else {
        return res.redirect("/");
      }
    });
  }
});

router.get("/forgetpass", (req, res, next) => {
  res.render("forget.ejs");
});

router.post("/forgetpass", (req, res, next) => {
  User.findOne({ email: req.body.email }, (err, data) => {
    if (!data) {
      res.send({ Success: "This Email Is not regestered!" });
    } else {
      if (req.body.password == req.body.passwordConf) {
        data.password = req.body.password;
        data.passwordConf = req.body.passwordConf;

        data.save((err, Person) => {
          if (err) console.log(err);
          else console.log("Success");
          res.send({ Success: "Password changed!" });
        });
      } else {
        res.send({
          Success: "Password does not matched! Both Password should be same.",
        });
      }
    }
  });
});

const uuid = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const com_id = () => {
  var val = Math.floor(1000 + Math.random() * 9000);
  return val;
};

const authentication = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });
  return { sheets };
};

module.exports = router;
