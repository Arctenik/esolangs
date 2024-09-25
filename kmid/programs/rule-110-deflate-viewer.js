const fs = require("fs");

// https://raw.githubusercontent.com/nodeca/pako/refs/heads/master/dist/pako.min.js
const pako = require("./pako.min.js");
let d = fs.readFileSync("./rule-110.deflate");
const rex = /(22 d0 55 24 90 c7 46 aa 34 81 62 8f 40 b9 46 a0 5c 23 50 dc 03 04 10 40 00 01 00 00 00 ff ff 22 10 df 00 01 04 10 40 00 01 04 10 40 00 01 04 10 40 00 01 04 10 40 00 01 04 00 ef 05 10 fa)|(22 d0 17 24 90 c7 46 aa 34 81 72 8d 40 c1 45 a0 e0 22 50 dc 03 04 10 40 00 01 00 00 00 ff ff 22 10 df 00 01 04 10 40 00 01 04 10 40 00 01 04 10 40 00 01 04 10 40 00 01 04 00 ef 05 10 fa)/g;
const step = () => {
  console.log(Array.from(Array.from(d, n => n.toString(16).padStart(2, "0")).join(" ").matchAll(rex), m => m[1] ? "0" : "1").join(""));
  for (let i = 0; i < 6; i++) d = pako.inflateRaw(d);
}

step();
step();
step();
step();
step();
