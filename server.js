import users from './public/bbdd/bbdd.js';
import webServer from './web-server/web-server.js';("./web-server/web-server.js");

console.log(await users.getUserByID("1001"))
console.log(await users.addCam("1001", {
    id: 2,
    name: "camara patio"
}))
console.log(await users.createUser(1002, "Raul", "123"));

webServer();