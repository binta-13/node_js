const { query } = require("express");
const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("express-flash");
const db = require("./connection/db");
const upload = require("./middlewares/uploadFile");
const app = express();
const PORT = 4000;

let isLogin = true;

app.set("view engine", "hbs"); // set template engine

app.use("/public", express.static(__dirname + "/public"));
app.use("/uploads", express.static(__dirname + "/uploads")); // set folder to public
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    cookie: {
      maxAge: 2 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
    },
    store: new session.MemoryStore(),
    saveUninitialized: true,
    resave: false,
    secret: "secretValue",
  })
);

let month = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "Desember",
];

app.use(flash());

app.get("/", function (req, res) {
  let query = "SELECT * FROM experience";
  db.connect(function (err, client, done) {
    if (err) throw err;

    client.query(query, function (err, result) {
      let data = result.rows;
      res.render("index", { blog: data }); // Only send 'Hello World' text
      console.log(data);
    });
  });
});

app.get("/contact-me", function (req, res) {
  res.render("contact");
});

app.get("/add-blog", function (req, res) {
  res.render("add-blog", {
    isLogin: req.session.isLogin,
    user: req.session.user,
  }); // render file add-blog
});

app.get("/blog", function (req, res) {
  db.connect(function (err, client, done) {
    if (err) throw err;
    let query = `SELECT blog.id, blog.title, blog.content, blog.img, tb_user.name AS author,blog.post_at  FROM blog LEFT JOIN tb_user 
    ON tb_user.id = blog.author_id`;
    client.query(query, function (err, result) {
      done();
      if (err) throw err;
      let data = result.rows;

      data = data.map(function (blog) {
        return {
          ...blog,
          post_at: getFullTime(blog.post_at),
          // post_age: getDistanceTime(blog.post_at),
          img: "/uploads/" + blog.img,
          isLogin: req.session.isLogin,
        };
      });
      console.log(data);
      res.render("blog", {
        isLogin: req.session.isLogin,
        blogs: data,
        user: req.session.user,
      });
    });
  });
  // res.render("blog", { isLogin: isLogin, blogs: data }); // render file blog
});

app.get("/detail-blog/:id", function (req, res) {
  let id = req.params.id;

  db.connect(function (err, client, done) {
    if (err) throw err;
    client.query(`SELECT * FROM blog WHERE id = ${id}`, function (err, result) {
      if (err) throw err;
      
      let data = result.rows[0];

      res.render("blog-detail", { id: id, blog: data });
    });
  });
});

app.get("/register", function (req, res) {
  res.render("register"); // render file add-blog
});

app.get("/edit-blog", function (req, res) {
  res.render("edit-blog"); // render file add-blog
});

app.post("/register", function (req, res) {
  const data = req.body;

  const hasheadPassword = bcrypt.hashSync(data.password, 10);

  let query = `INSERT INTO tb_user (name, email, password) VALUES ('${data.name}','${data.email}','${hasheadPassword}')`;

  db.connect(function (err, client, done) {
    if (err) throw err;

    client.query(query, function (err, result) {
      if (err) throw err;

      res.redirect("/login"); // render file add-blog
    });
  });
});

app.get("/login", function (req, res) {
  res.render("login"); // render file add-blog
});

app.post("/login", function (req, res) {
  const { email, password } = req.body;

  let query = `SELECT * FROM tb_user WHERE email = '${email}'`;

  db.connect(function (err, client, done) {
    if (err) throw err;

    client.query(query, function (err, results) {
      if (err) throw err;

      if (results.rows.length == 0) {
        req.flash("danger", "email and password failed");
        return res.redirect("/login");
      }

      let isMacth = bcrypt.compareSync(password, results.rows[0].password);

      if (isMacth) {
        req.session.isLogin = true;
        req.session.user = {
          id: results.rows[0].id,
          name: results.rows[0].name,
          emai: results.rows[0].email,
        };

        req.flash("success", "login succes");

        res.redirect("/blog");
      } else {
        req.flash("danger", "login failed");
        res.redirect("/login");
      }
    });
  });
});

app.get("/edit-blog/:id", function (req, res) {
  let id = req.params.id;
  let query = `SELECT * FROM blog WHERE id = ${id}`;
  db.query(query, function (err, result) {
    if (err) throw err;
    let data = result.rows[0];
    console.log(data);
    res.render("edit-blog", { id: id, data: data });
  });
});

app.get("/delet-blog/:id", function (req, res) {
  let id = req.params.id;
  let query = `DELETE FROM blog WHERE id = ${id}`;
  db.connect(function (err, client, done) {
    if (err) throw err;
    client.query(query, function (err, result) {
      if (err) throw err;
      res.redirect("/blog");
    });
  });
});

app.post("/edit-blog/:id", function (req, res) {
  let data = req.body;
  let id = req.params.id;
  let query = `UPDATE blog SET title = '${data.title}', content = '${data.content}', img = '${data.img}' WHERE id = ${id}`;

  db.connect(function (err, client, done) {
    
    if (err) throw err;

    client.query(query, function (err, result) {
      if (err) throw err;
      res.redirect("/blog");
    });
  });
});

app.post("/blog", upload.single("img"), function (req, res) {
  let data = req.body;
  console.log(data);
  if (!req.session.user) {
    req.flash("danger", "Please login");
    return res.redirect("/add-blog");
  }

  if (!req.file.filename) {
    req.flash("danger", "Please Insert ALL Fields");
    return res.redirect("/add-blog");
  }

  let authorId = req.session.user.id;

  let img = req.file.filename;

  let query = `INSERT INTO blog(title, content, img, author_id) VALUES ('${data.title}','${data.content}','${img}','${authorId}')`;

  db.connect(function (err, client, done) {
    if (err) throw err;

    client.query(query, function (err, result) {
      if (err) throw err;
      res.redirect("/blog");
    });
  });
});

app.get("/logout", function (req, res, next) {
  if (req.session) {
    // delete session object
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        return res.redirect("/blog");
      }
    });
  }
});
function getFullTime(time) {
  let date = time.getDate();
  let monthIndex = time.getMonth();
  let year = time.getFullYear();
  let hours = time.getHours();
  let minutes = time.getMinutes();

  let fullTime = `${date} ${month[monthIndex]} ${year} ${hours}:${minutes} WIB`;
  return fullTime;
}

// To bind and listen the connections on the specified host and port
app.listen(PORT, function () {
  console.log(`Server starting on PORT: ${PORT}`);
});
