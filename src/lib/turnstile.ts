// Production sitekey (widget "nbdevlab contact form", valid on nbdevlab.com and www.nbdevlab.com).
// Local development uses Cloudflare's always-pass test key so the admin sandbox keeps working.
export const TURNSTILE_SITE_KEY = import.meta.env.DEV ? '1x00000000000000000000AA' : '0x4AAAAAAFwPccaAhxmipn2Z'

// Name of the hidden input Turnstile adds to the form.
export const TURNSTILE_FIELD = 'cf-turnstile-response'
