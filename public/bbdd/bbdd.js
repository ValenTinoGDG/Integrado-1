import fs from 'fs';

console.log('bbdd ejecutandose...');

const userBluePrint = {
  inUse: false,
  data: {
    name: "",
    password: "",
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
    const user = await openFile("users", id);
    console.log(user);
    return user.data;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
};

async function addCam (id, cam) {
  try {
    const user = await openFile("users", id); // Obtener los datos del usuario

    //if(user.inUse) return null;
    
    const camPath = "./public/bbdd/users/" + id + "/" + cam.id // Decidimos una ruta para almacenar el video de la camara
    
    if(user.data.cams.find(e => e.id == cam.id)) return "2" // Si ya existe una camara con ese ID cancelamos
    
    user.data.cams.push( // Añadimos los datos de la camara
      {
        id: cam.id,
        name: cam.name,
        path: camPath
      }
    )

    if(!writeFile("users", id, user)) return null; // Los guardamos en la base de datos

    if(!fs.existsSync(camPath)){ // Creamos la ruta que hemos decidido (si no existe ya)
      fs.mkdirSync(camPath);
    }

    return true;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}

async function createUser (id, name, password) {
  var user = userBluePrint;
  user.data.name = name;
  user.data.password = password;

  const userPath = "./public/bbdd/users/" + id 

  if(!fs.existsSync(userPath)){ // Creamos la ruta que hemos decidido (si no existe ya)
    fs.mkdirSync(userPath);
  }else{
    return 2;
  }

  writeFile("users", id, user);
  return 1;
}

const users = {
  getUserByID,
  addCam,
  createUser
};

export default users;