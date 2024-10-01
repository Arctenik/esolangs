const fs = require("fs");

// https://raw.githubusercontent.com/nodeca/pako/refs/heads/master/dist/pako.min.js
const pako = require("./pako.min.js");
let d = fs.readFileSync("./rule-110.deflate");
const rex = /(c2 dd 93 c0 9d b3 86 9b 0c ee b2 0a 77 89 84 bb 44 c2 5d f6 02 00 00 00 ff ff c2 1d 3f 00 01 04 10 40 00 01 04 10 40 00 01 04 10 40 00 01 04 00 2e 05 d1 fa)|(c2 dd 5f c0 9d b3 86 9b 0c ee 12 09 77 b9 83 bb dc c1 5d f6 02 00 00 00 ff ff c2 1d 3f 00 01 04 10 40 00 01 04 10 40 00 01 04 10 40 00 01 04 00 2e 05 d1 fa)/g;
let history = "";
const step = (n = 1) => {
  for (let i = 0; i < n; i++) {
    let r;
    console.log(r = Array.from(Array.from(d, n => n.toString(16).padStart(2, "0")).join(" ").matchAll(rex), m => m[1] ? "0" : "1").join(""));
    history = history.replaceAll("\n", "\n ") + "\n" + r.replaceAll("0", " ").replaceAll("1", "#");
    for (let i = 0; i < 6; i++) d = pako.inflateRaw(d);
  }
}

step(10);

console.log(history);
