import {
  EXPIRED,
  NOT_COME_EFFECT,
  NOT_FOUND_CA,
  VALID_CA,
  INVALID_CA,
  AUTO_SIGNATURE,
  NO_AUTO_SIGNATURE,
} from "./constants.js";
import express from "express";
import multer from "multer";
import { exec } from "child_process";
import path from "path";
import cors from "cors";
import fs from "fs";
import forge from "node-forge";
import { fileURLToPath } from "url";

multer({ dest: "/tmp/uploads-cert/" });
multer({ dest: "/tmp/uploads-ca/" });

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/health-check", async (req, res) => {
  return res.status(200).json({ message: "Ok" });
});

app.post("/validate-cert", async (req, res) => {
  const { certFileName } = req.body;

  if (!certFileName) return res.status(400).json({ error: MANDATORY_FILENAME });

  // Caminho para a pasta onde os certificados e CAs estão armazenados
  const certsDir = path.join(__dirname, "/tmp/uploads-cert");
  const certPath = path.join(certsDir, certFileName);

  // Verificar se o arquivo do certificado existe
  if (!fs.existsSync(certPath))
    return res.status(404).json({ error: CERT_NOT_FOUND });

  try {
    let result = [];
    tryToValidateSignatureAndExpirationDate(certPath, result);

    const caDir = path.join(__dirname, "/tmp/uploads-ca");
    if (!fs.existsSync(caDir))
      return res.status(200).json({
        message: NO_CA,
        result: [...result, NOT_FOUND_CA],
      });

    const caFiles = fs
      .readdirSync(caDir)
      .filter((file) => file.endsWith(".crt") || file.endsWith(".pem"));

    if (caFiles.length === 0)
      return res.status(200).json({
        message: NO_CA,
        result: [...result, NOT_FOUND_CA],
      });

    const validateAgainstCAs = async () => {
      let isValidCA = false;

      for (const caFile of caFiles) {
        const caPath = path.join(caDir, caFile);
        console.log(caPath, certPath);
        try {
          const a = await execPromise(
            `openssl verify -CAfile "${caPath}" "${certPath}"`
          );
          console.log("a", a);
          isValidCA = true;
        } catch (e) {}
      }

      return isValidCA;
    };

    if (await validateAgainstCAs()) result.push(VALID_CA);
    else result.push(INVALID_CA);

    return res.status(200).json({ message: CONCLUDED_VALIDATION, result });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Erro lendo certificado.", details: e.message });
  }
});

const tryToValidateSignatureAndExpirationDate = (certPath, result) => {
  try {
    const pem = fs.readFileSync(certPath, "utf8");
    const certificate = forge.pki.certificateFromPem(pem);

    const resultExpirationDate = verifyExpirationDate(certificate);
    if (resultExpirationDate) result.push(resultExpirationDate);

    const resultAutoSignature = isAutoSignature(certificate);
    result.push(resultAutoSignature);
  } catch (e) {}
};

const execPromise = (command) =>
  new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) reject(stderr);
      else resolve(stdout);
    });
  });

const verifyExpirationDate = (certificate) => {
  const now = new Date();
  const notBefore = certificate.validity.notBefore;
  const notAfter = certificate.validity.notAfter;

  if (notAfter < now) return EXPIRED;
  else if (notBefore > now) return NOT_COME_EFFECT;

  return;
};

const isAutoSignature = (certificate) => {
  if (certificate.subject.hash === certificate.issuer.hash)
    return AUTO_SIGNATURE;

  const issuer = certificate.issuer.attributes.find(
    ({ shortName }) => shortName === "CN"
  )?.value;

  return {
    ...NO_AUTO_SIGNATURE,
    message: NO_AUTO_SIGNATURE.message + issuer,
  };
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.path.includes("/upload-ca")) {
      cb(null, "/tmp/uploads-ca/");
    } else if (req.path.includes("/upload-cert")) {
      cb(null, "/tmp/uploads-cert/");
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`);
  },
});

// Middleware para upload
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /cer|crt/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (extname) return cb(null, true);

    cb(new Error(RESTRICT_FILES));
  },
});

// Endpoint para upload de certificado
app.post("/upload-cert", upload.single("certificate"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: EMPTY_CONTENT });

    res.json({ fileName: req.file.filename, message: SUCCESS_CERT });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: PROCESS_CERT_ERROR, error: err.message });
  }
});

app.post("/upload-ca", upload.single("caCertificate"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: EMPTY_CONTENT });

    res.json({ fileName: req.file.filename, message: SUCCESS_CA });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: PROCESS_CERT_ERROR, error: err.message });
  }
});

const {
  PROCESS_CERT_ERROR,
  SUCCESS_CA,
  SUCCESS_CERT,
  EMPTY_CONTENT,
  RESTRICT_FILES,
  MANDATORY_FILENAME,
  CERT_NOT_FOUND,
  NO_CA,
  CONCLUDED_VALIDATION,
} = {
  PROCESS_CERT_ERROR: "Erro ao processar o certificado.",
  ISNT_CA: "Este certificado não é de uma Autoridade Certificadora (CA).",
  SUCCESS_CA: "Certificado de CA processado com sucesso.",
  SUCCESS_CERT: "Certificado processado com sucesso.",
  EMPTY_CONTENT: "Nenhum arquivo enviado.",
  VERIFY_ERROR: "Erro ao verificar o certificado",
  RESTRICT_FILES: "Apenas arquivos .cer ou .crt são permitidos.",
  MANDATORY_FILENAME: "O nome do arquivo do certificado é obrigatório.",
  CERT_NOT_FOUND: "Certificado não encontrado.",
  NO_CA: "Nenhuma CA encontrada para validação.",
  CONCLUDED_VALIDATION: "Validação concluída.",
};

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

export default app;
