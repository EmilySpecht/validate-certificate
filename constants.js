export const {
  EXPIRED,
  NOT_COME_EFFECT,
  NOT_FOUND_CA,
  VALID_CA,
  INVALID_CA,
  AUTO_SIGNATURE,
  NO_AUTO_SIGNATURE,
} = {
  AUTO_SIGNATURE: {
    name: "Auto-Signature",
    message: "Este certificado é auto assinado",
    color: "#0180FF",
    isValid: true,
  },
  NO_AUTO_SIGNATURE: {
    name: "Emissor",
    message: "Certificado assinado por ",
    color: "#0180FF",
    isValid: true,
  },
  VALID_CA: {
    name: "CA",
    message: "Este certificado tem uma CA confiável",
    color: "#FFBD2F",
    isValid: true,
  },
  NOT_FOUND_CA: {
    name: "CA Subordinada",
    message: "Não foi encontrada nenhuma CA válida",
    color: "#FFBD2F",
    isValid: false,
  },
  INVALID_CA: {
    name: "CA Subordinada",
    message: "Não foi encontrada nenhuma CA válida",
    color: "#FFBD2F",
    isValid: false,
  },
  EXPIRED: {
    name: "Validity",
    message: "Este certificado está expirado",
    color: "#FF2FAC",
    isValid: false,
  },
  NOT_COME_EFFECT: {
    name: "Validity",
    message: "Este certificado ainda não entrou em vigor",
    color: "#FF2FAC",
    isValid: false,
  },
};
