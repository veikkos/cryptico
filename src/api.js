import aes from './aes'
import { int2char } from './jsbn'
import { math, SecureRandom } from './random'
import { MD5, sha256 } from './hash'
import { RSAKey } from './rsa'

const base64Chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

aes.Init()

export default {
  b256to64(t) {
    let a, c, n
    let r = '',
      // l = 0,
      s = 0
    const tl = t.length
    for (n = 0; n < tl; n++) {
      c = t.charCodeAt(n)
      if (s === 0) {
        r += base64Chars.charAt((c >> 2) & 63)
        a = (c & 3) << 4
      } else if (s === 1) {
        r += base64Chars.charAt(a | ((c >> 4) & 15))
        a = (c & 15) << 2
      } else if (s === 2) {
        r += base64Chars.charAt(a | ((c >> 6) & 3))
        // l += 1
        r += base64Chars.charAt(c & 63)
      }
      // l += 1
      s += 1
      if (s === 3) s = 0
    }
    if (s > 0) {
      r += base64Chars.charAt(a)
      // l += 1
      r += '='
      // l += 1
    }
    if (s === 1) {
      r += '='
    }
    return r
  },

  b64to256(t) {
    let c, n
    let r = '',
      s = 0,
      a = 0
    const tl = t.length
    for (n = 0; n < tl; n++) {
      c = base64Chars.indexOf(t.charAt(n))
      if (c >= 0) {
        if (s) r += String.fromCharCode(a | ((c >> (6 - s)) & 255))
        s = (s + 2) & 7
        a = (c << s) & 255
      }
    }
    return r
  },

  b16to64(h) {
    let i
    let c
    let ret = ''
    if (h.length % 2 === 1) {
      h = '0' + h
    }
    for (i = 0; i + 3 <= h.length; i += 3) {
      c = parseInt(h.substring(i, i + 3), 16)
      ret += base64Chars.charAt(c >> 6) + base64Chars.charAt(c & 63)
    }
    if (i + 1 === h.length) {
      c = parseInt(h.substring(i, i + 1), 16)
      ret += base64Chars.charAt(c << 2)
    } else if (i + 2 === h.length) {
      c = parseInt(h.substring(i, i + 2), 16)
      ret += base64Chars.charAt(c >> 2) + base64Chars.charAt((c & 3) << 4)
    }
    while ((ret.length & 3) > 0) ret += '='
    return ret
  },

  b64to16(s) {
    let ret = ''
    let i
    let k = 0
    let slop
    for (i = 0; i < s.length; ++i) {
      if (s.charAt(i) === '=') break
      const v = base64Chars.indexOf(s.charAt(i))
      if (v < 0) continue
      if (k === 0) {
        ret += int2char(v >> 2)
        slop = v & 3
        k = 1
      } else if (k === 1) {
        ret += int2char((slop << 2) | (v >> 4))
        slop = v & 0xf
        k = 2
      } else if (k === 2) {
        ret += int2char(slop)
        ret += int2char(v >> 2)
        slop = v & 3
        k = 3
      } else {
        ret += int2char((slop << 2) | (v >> 4))
        ret += int2char(v & 0xf)
        k = 0
      }
    }
    if (k === 1) ret += int2char(slop << 2)
    return ret
  },

  // Converts a string to a byte array.
  string2bytes(str) {
    const utf8 = []
    for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i)
      if (charcode < 0x80) utf8.push(charcode)
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f))
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(
          0xe0 | (charcode >> 12),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f),
        )
      }
      // surrogate pair
      else {
        i++
        // UTF-16 encodes 0x10000-0x10FFFF by
        // subtracting 0x10000 and splitting the
        // 20 bits of 0x0-0xFFFFF into two halves
        charcode =
          0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
        utf8.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f),
        )
      }
    }
    return utf8
  },

  // Converts a byte array to a string.
  bytes2string(data) {
    let str = '',
      i

    for (i = 0; i < data.length; i++) {
      const value = data[i]

      if (value < 0x80) {
        str += String.fromCharCode(value)
      } else if (value > 0xbf && value < 0xe0) {
        str += String.fromCharCode(((value & 0x1f) << 6) | (data[i + 1] & 0x3f))
        i += 1
      } else if (value > 0xdf && value < 0xf0) {
        str += String.fromCharCode(
          ((value & 0x0f) << 12) |
            ((data[i + 1] & 0x3f) << 6) |
            (data[i + 2] & 0x3f),
        )
        i += 2
      } else {
        // surrogate pair
        const charCode =
          (((value & 0x07) << 18) |
            ((data[i + 1] & 0x3f) << 12) |
            ((data[i + 2] & 0x3f) << 6) |
            (data[i + 3] & 0x3f)) -
          0x010000

        str += String.fromCharCode(
          (charCode >> 10) | 0xd800,
          (charCode & 0x03ff) | 0xdc00,
        )
        i += 3
      }
    }

    return str
  },

  // Returns a XOR b, where a and b are 16-byte byte arrays.
  blockXOR(a, b) {
    const xor = new Array(16)
    for (let i = 0; i < 16; i++) {
      xor[i] = a[i] ^ b[i]
    }
    return xor
  },

  // Returns a 16-byte initialization vector.
  blockIV() {
    const r = new SecureRandom()
    const IV = new Array(16)
    r.nextBytes(IV)
    return IV
  },

  // Returns a copy of bytes with zeros appended to the end
  // so that the (length of bytes) % 16 === 0.
  pad16(bytes) {
    const newBytes = bytes.slice(0)
    const padding = (16 - (bytes.length % 16)) % 16
    for (let i = bytes.length; i < bytes.length + padding; i++) {
      newBytes.push(0)
    }
    return newBytes
  },

  // Removes trailing zeros from a byte array.
  depad(bytes) {
    let newBytes = bytes.slice(0)
    while (newBytes[newBytes.length - 1] === 0) {
      newBytes = newBytes.slice(0, newBytes.length - 1)
    }
    return newBytes
  },

  // AES CBC Encryption.
  encryptAESCBC(plaintext, key) {
    const exkey = key.slice(0)
    aes.ExpandKey(exkey)
    let blocks = this.string2bytes(plaintext)
    blocks = this.pad16(blocks)
    let encryptedBlocks = this.blockIV()
    for (let i = 0; i < blocks.length / 16; i++) {
      let tempBlock = blocks.slice(i * 16, i * 16 + 16)
      const prevBlock = encryptedBlocks.slice(i * 16, i * 16 + 16)
      tempBlock = this.blockXOR(prevBlock, tempBlock)
      aes.Encrypt(tempBlock, exkey)
      encryptedBlocks = encryptedBlocks.concat(tempBlock)
    }
    const ciphertext = this.bytes2string(encryptedBlocks)
    return this.b256to64(ciphertext)
  },

  // AES CBC Decryption.
  decryptAESCBC(encryptedText, key) {
    const exkey = key.slice(0)
    aes.ExpandKey(exkey)
    const asciiText = this.b64to256(encryptedText)
    const encryptedBlocks = this.string2bytes(asciiText)
    let decryptedBlocks = []
    for (let i = 1; i < encryptedBlocks.length / 16; i++) {
      let tempBlock = encryptedBlocks.slice(i * 16, i * 16 + 16)
      const prevBlock = encryptedBlocks.slice((i - 1) * 16, (i - 1) * 16 + 16)
      aes.Decrypt(tempBlock, exkey)
      tempBlock = this.blockXOR(prevBlock, tempBlock)
      decryptedBlocks = decryptedBlocks.concat(tempBlock)
    }
    decryptedBlocks = this.depad(decryptedBlocks)
    return this.bytes2string(decryptedBlocks)
  },

  // Wraps a str to 60 characters.
  wrap60(str) {
    let outstr = ''
    for (let i = 0; i < str.length; i++) {
      if (i % 60 === 0 && i !== 0) outstr += '\n'
      outstr += str[i]
    }
    return outstr
  },

  // Generate a random key for the AES-encrypted message. ciphertext.split
  generateAESKey() {
    const key = new Array(32)
    const r = new SecureRandom()
    r.nextBytes(key)
    return key
  },

  // Generates an RSA key from a passphrase.
  generateRSAKey(passphrase, bitlength) {
    math.seedrandom(sha256.hex(passphrase))
    const rsa = new RSAKey()
    rsa.generate(bitlength, '03')
    return rsa
  },

  // Returns the ascii-armored version of the public key.
  publicKeyString(rsakey) {
    return this.b16to64(rsakey.n.toString(16))
  },

  // Returns an MD5 sum of a publicKeyString for easier identification.
  publicKeyID(publicKeyString) {
    return MD5(publicKeyString)
  },

  publicKeyFromString(string) {
    const N = this.b64to16(string.split('|')[0])
    const E = '03'
    const rsa = new RSAKey()
    rsa.setPublic(N, E)
    return rsa
  },

  encrypt(plaintext, publickeystring, signingkey) {
    let cipherblock = ''
    const aeskey = this.generateAESKey()
    try {
      const publickey = this.publicKeyFromString(publickeystring)
      cipherblock +=
        this.b16to64(publickey.encrypt(this.bytes2string(aeskey))) + '?'
    } catch (err) {
      return {
        status: 'Invalid public key',
      }
    }
    if (signingkey) {
      plaintext += this.sign(plaintext, signingkey)
    }
    cipherblock += this.encryptAESCBC(plaintext, aeskey)
    return {
      status: 'success',
      cipher: cipherblock,
    }
  },
  decrypt(ciphertext, key) {
    const cipherblock = ciphertext.split('?')
    let aeskey = key.decrypt(this.b64to16(cipherblock[0]))
    if (!aeskey) {
      return {
        status: 'failure',
      }
    }
    aeskey = this.string2bytes(aeskey)
    const plaintext = this.decryptAESCBC(cipherblock[1], aeskey)
    if (plaintext.indexOf('::52cee64bb3a38f6403386519a39ac91c::') !== -1) {
      return this._confirm(plaintext)
    } else {
      return {
        status: 'success',
        plaintext: plaintext[0],
        signature: 'unsigned',
      }
    }
  },

  sign(plaintext, signingkey) {
    const signString = cryptico.b16to64(
      signingkey.signString(plaintext, 'sha256'),
    )
    plaintext += '::52cee64bb3a38f6403386519a39ac91c::'
    plaintext += cryptico.publicKeyString(signingkey)
    plaintext += '::52cee64bb3a38f6403386519a39ac91c::'
    plaintext += signString
    return plaintext
  },

  verify(plaintext) {
    const result = this._confirm(plaintext)
    return result.status === 'success' && result.signature === 'verified'
  },

  _confirm(plaintext) {
    plaintext = plaintext.split('::52cee64bb3a38f6403386519a39ac91c::')
    if (plaintext.length === 3) {
      const publickey = this.publicKeyFromString(plaintext[1])
      const signature = this.b64to16(plaintext[2])
      if (publickey.verifyString(plaintext[0], signature)) {
        return {
          status: 'success',
          plaintext: plaintext[0],
          signature: 'verified',
          publicKeyString: this.publicKeyString(publickey),
        }
      } else {
        return {
          status: 'success',
          plaintext: plaintext[0],
          signature: 'forged',
          publicKeyString: this.publicKeyString(publickey),
        }
      }
    } else {
      return {
        status: 'failure',
      }
    }
  },
}
