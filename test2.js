import { Greeter, wow } from './test.js'
window.Greeter = Greeter
window.wow = wow

let a = new Greeter('Keith')
a.greet()
