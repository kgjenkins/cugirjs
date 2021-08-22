export class Greeter {
  constructor(name) {
    this.name = name;
  }
  greet() {
    console.log(`Hello, ${this.name}!`)
  }
}

export function wow (x) {
  console.log(x + 2)
}
