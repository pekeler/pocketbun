// Ported from pocketbase/plugins/jsvm/mapper.go

const nameExceptions: Record<string, string> = {
  OAuth2: "oauth2",
};

const reverseNameExceptions: Record<string, string> = {
  mfa: "MFA",
  oauth2: "OAuth2",
  otp: "OTP",
};

export function convertGoToJSName(name: string): string {
  if (nameExceptions[name]) {
    return nameExceptions[name] ?? name;
  }

  let startUppercase = "";
  for (const char of name) {
    const isUpper = char >= "A" && char <= "Z";
    const isDigit = char >= "0" && char <= "9";
    if (char !== "_" && !isUpper && !isDigit) {
      break;
    }
    startUppercase += char;
  }

  const totalStartUppercase = startUppercase.length;
  if (totalStartUppercase === 0) {
    return name;
  }

  if (name.length === totalStartUppercase) {
    return name.toLowerCase();
  }

  if (totalStartUppercase > 1) {
    return `${name.slice(0, totalStartUppercase - 1).toLowerCase()}${name.slice(totalStartUppercase - 1)}`;
  }

  return `${name.slice(0, 1).toLowerCase()}${name.slice(1)}`;
}

export function convertJSToGoName(name: string): string {
  if (reverseNameExceptions[name]) {
    return reverseNameExceptions[name] ?? name;
  }

  return `${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
}

export class FieldMapper {
  FieldName(_type: unknown, field: { Name: string }): string {
    return convertGoToJSName(field.Name);
  }

  MethodName(_type: unknown, method: { Name: string }): string {
    return convertGoToJSName(method.Name);
  }
}
