import { cleanEnv, str } from "envalid";

export default cleanEnv(process.env, {
  DISCORD_TOKEN: str(),
  ALL_MUTED_ROLE: str()
});
