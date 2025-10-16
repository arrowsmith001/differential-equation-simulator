import { render } from "preact";
import { ExpressionInput } from "./ui/ExpressionInput";

function App() {
  return (
    <div>
      <h1>Math System Editor</h1>
      <ExpressionInput />
    </div>
  );
}

render(<App />, document.getElementById("app")!);
