import fs from 'fs';
import { randomUUID } from 'crypto';

console.log('BBDD ejecutandose...');

const userBluePrint = {
  inUse: false,
  data: {
    email: "",
    cams: []
  }
}

async function openFile (db, id) {
  return await JSON.parse(fs.readFileSync("./public/bbdd/" + db + "/" + id + "/" + "user.json", 'utf8'));
}

function writeFile(db, id, file) {
  fs.writeFileSync("./public/bbdd/" + db + "/" + id + "/" + "user.json", JSON.stringify(file, null, 2));
  return 1;
}

async function getUserByID (id) {
  try {
    const user = await openFile("user", id);
    return user.data;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
};

async function delCam(userId, camId) {
  try {
    // Si no hay ID de camara nos vamos
    if (!camId) {
      console.error("Camera ID is required to delete.");
      return null;
    }

    const user = await openFile("user", userId); // Caragamos los datos del usuario

    // Quitamos la camara (si existe)
    const originalLength = user.data.cams.length;
    user.data.cams = user.data.cams.filter(cam => cam.id !== camId);

    // Si no existe nos vamos
    if (user.data.cams.length === originalLength) {
      console.warn(`Camera with ID ${camId} not found.`);
      return null;
    }

    // Guardamos los datos
    if (!writeFile("user", userId, user)) return null;

    // Borramos la ruta de la camara elminada
    const camPath = `./public/bbdd/user/${userId}/${camId}`;
    if (fs.existsSync(camPath)) {
      fs.rmSync(camPath, { recursive: true, force: true });
    }

    return true;
  } catch (error) {
    console.error("Error deleting camera:", error.message);
    return null;
  }
}

async function addCam(id, newCam) {
  try {
    const user = await openFile("user", id); // Obtener los datos del usuario

    // Generamos una ID si no hay (caso de editar)
    if (!newCam.id) {
      newCam.id = crypto.randomUUID();
    }

    const camPath = "./public/bbdd/user/" + id + "/" + newCam.id;

    user.data.cams.forEach(oldCam => {
      console.log(oldCam.id, newCam.id)
    });

    // Buscamos si ya existe (caso de editar)
    if (user.data.cams.find(oldCam => oldCam.id === newCam.id)){
      // Borramos la vieja
      user.data.cams = user.data.cams.filter(oldCam => oldCam.id != newCam.id )
      console.log(user.data.cams)
    } 

    // Le metemos la camara
    user.data.cams.push({
      id: newCam.id,
      name: newCam.name,
      ip: newCam.ip,
      user: newCam.user,
      password: newCam.password
    });

    // Gaurdamos el archivo actualizado
    if (!writeFile("user", id, user)) return null;

    // Creamos la carpeta de la camara si no existe
    if (!fs.existsSync(camPath)) {
      fs.mkdirSync(camPath);
    }

    return true;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}

async function createUser (id, email) {
  var user = userBluePrint;
  user.data.email = email;
  user.data.id = id;

  const userPath = "./public/bbdd/user/" + id 

  if(!fs.existsSync(userPath)){ // Creamos la ruta que hemos decidido (si no existe ya)
    fs.mkdirSync(userPath);
  }else{
    return 2;
  }

  writeFile("user", id, user);
  return 1;
}

const users = {
  getUserByID,
  addCam,
  createUser,
  delCam
};

export default users;