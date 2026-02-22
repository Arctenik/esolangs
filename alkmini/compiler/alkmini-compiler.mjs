import { parseAlkmini } from "../alkmini-parser.mjs";

const programInp = document.getElementById("programInp");
const compileButton = document.getElementById("compileButton");
const resultElem = document.getElementById("resultElem");

compileButton.addEventListener("click", async () => {
  await kmidParserPromise;
  const code = programInp.value;
  resultElem.textContent = compileAlkmini(parseAlkmini(code));
});

resultElem.addEventListener("dblclick", () => {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNode(resultElem);
  selection.removeAllRanges();
  selection.addRange(range);
});


function compileAlkmini(program) {
  
}
