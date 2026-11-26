import RootLayout from "./layout";
import StoreLayout from "./(store)/layout";
import StoreNotFound from "./(store)/not-found";

export default function GlobalNotFound() {
  return <RootLayout><StoreLayout><StoreNotFound /></StoreLayout></RootLayout>;
}
