// helper functions for running the javascript

callCounts = {};
breakpoint = (id, callLimit, logData, f) => {
  console.log(logData);
  if ((callCounts[id] = (callCounts[id] ?? 0) + 1) > callLimit) throw "breakpoint: " + id;
  return f();
};

// function to render the bct program or data
renderList = list => {
  return list(
    head => tail =>
      head(_ => "0")(_ => "1") + renderList(tail)
  )(
    _ => ""
  )
};


// lc program

// misc notes:
// - lists are read by calling them as functions, with one callback for a nonempty list and one callback for an empty list
// - bits are read in a similar way, with one callback for zero and one callback for one
// - recursion is accomplished by having the recursive function take itself as its first parameter, and then passing the function to itself whenever it's called;
//   e.g. the step function can be called as `step(step)(program)(data)`, taking itself as the first argument and the program and data as the second and third arguments
(nil => cons => zero => one =>
  (
    append =>
      (
        step =>
          // run the program
          step(step)(
            // initial program ("simple illustration" from wiki)
            cons(one)(cons(zero)(cons(one)(cons(one)(cons(one)(cons(one)(cons(zero)(cons(one)(cons(one)(cons(one)(cons(zero)(cons(zero)(cons(one)(cons(one)(cons(one)(cons(zero)(cons(one)(cons(one)(cons(zero)(nil)))))))))))))))))))
          )(
            // initial data
            cons(one)(nil)
          )
      )(
        // step definition
        // takes itself for recursion, as well as a list representing the program and a list representing the data
        // breaks after 22 calls, logging the program and data with each call
        step => program => data => breakpoint("step", 22, [renderList(program), renderList(data)], () =>
          // read program
          program(
            // program nonempty
            pHead => pTail =>
              // read first program bit
              pHead(
                // program bit 0; read data
                _ => data(
                  // data nonempty
                  dHead => dTail =>
                    // do next step
                    step(step)(
                      // move program bit to end
                      append(append)(pTail)(pHead)
                    )(
                      // discard data bit
                      dTail
                    )
                )(
                  // data empty; halt
                  _ => nil
                )
              )(
                // program bit 1; read data
                _ => data(
                  // data nonempty
                  dHead => dTail =>
                    // read first data bit
                    dHead(
                      // data bit 0; do next step
                      _ => step(step)(
                        // build updated program; read program tail
                        pTail(
                          // program tail nonempty
                          pTailHead => pTailTail =>
                            append(append)(
                              append(append)(pTailTail)(pHead)
                            )(
                              pTailHead
                            )
                        )(
                          // program tail empty; set program to nil for lack of anything better to do
                          nil
                        )
                      )(
                        // data stays as-is
                        data
                      )
                    )(
                      // data bit 1; read program tail
                      _ => pTail(
                        // program tail nonempty
                        pTailHead => pTailTail =>
                          // do next step
                          step(step)(
                            // update program
                            append(append)(
                              append(append)(pTailTail)(pHead)
                            )(pTailHead)
                          )(
                            // append bit to data
                            append(append)(data)(pTailHead)
                          )
                      )(
                        // program tail empty; halt
                        _ => nil
                      )
                    )
                )(
                  // data empty; halt
                  _ => nil
                )
              )
          )(
            // program empty; halt
            _ => nil
          )
        )
      )
  )(
    // append definition
    // takes itself for recursion, as well as a list and an item to append to the end of the list
    append => list => item =>
      list(
        head => tail => cons(head)(append(append)(tail)(item))
      )(
        _ => cons(item)(nil)
      )
  )
)(
  // nil definition
  // takes a function to call for a nonempty list and a function to call for an empty list, and calls the empty case one
  fNonempty => fEmpty => fEmpty(/* pass in whatever here. it should be ignored */)
)(
  // cons definition
  // returns a list formed from the given head and tail
  // the list takes a function to call for a nonempty list and a function to call for an empty list, and calls the nonempty case one with the head and tail values
  head => tail => (fNonempty => fEmpty => fNonempty(head)(tail))
)(
  // zero definition
  // takes a function to call for zero and a function to call for one, and calls the zero case function
  f => g => f(/* pass whatever */)
)(
  // one definition
  // takes a function to call for zero and a function to call for one, and calls the one case function
  f => g => g(/* pass whatever */)
)