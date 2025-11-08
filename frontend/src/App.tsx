import { renderRoutes, routes } from "./routes/routes";

const App = () => {
  return (
    <div>
      {renderRoutes(routes)}
      {/* <DebugAuth /> */}
    </div>
  );
};

export default App;
