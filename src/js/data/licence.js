// Licence URL -> the app's rights model. Shared by every source that states a licence URL.
const CC_NAMES = { by: 'Attribution', nc: 'NonCommercial', nd: 'NoDerivs', sa: 'ShareAlike' }

export function mapLicenceUrl(url) {
  const link = url.replace(/^http:/, 'https:')
  const cc = link.match(/creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i)
  if (cc) {
    const terms = cc[1].toUpperCase().split('-')
    return {
      state: 'licensed',
      short: `CC ${terms.join('-')} ${cc[2]}`,
      label: `Creative Commons ${cc[1]
        .toLowerCase()
        .split('-')
        .map((t) => CC_NAMES[t] ?? t)
        .join('-')} ${cc[2]}`,
      terms,
      licence_url: link,
      attribution_required: terms.includes('BY'),
    }
  }
  if (/creativecommons\.org\/publicdomain\/zero/i.test(link)) {
    return { state: 'public_domain', short: 'CC0 1.0', label: 'CC0 1.0 Universal', licence_url: link }
  }
  if (/creativecommons\.org\/publicdomain\/mark/i.test(link)) {
    return { state: 'public_domain', short: 'Public domain', label: 'Public domain mark', licence_url: link }
  }
  return { state: 'unknown', short: 'Licence not recognised', label: 'Licence not recognised', licence_url: link }
}
