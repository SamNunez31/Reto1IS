"""
Pruebas de seguridad LOCALES contra el backend (por defecto http://localhost:3100) y su BD Docker.
NUNCA apuntar a Render, Vercel ni Supabase: el script se niega si la URL no es localhost/127.0.0.1.

Uso (ver docs/DOCUMENTO_TECNICO.md → "Pruebas de seguridad"):
  python backend/scripts/pruebas-seguridad.py [URL_BASE] [JWT_SECRET_LOCAL]
Requiere usuarios demo (02_datos_demo.sql) y que el login no haya sido usado >1 vez en el último minuto (rate limit 5/min).
Escribe un resultado por línea: OK / FALLA / INFO.
"""
import base64, hashlib, hmac, json, sys, time, urllib.error, urllib.parse, urllib.request, uuid
from datetime import date, timedelta

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3100').rstrip('/')
SECRETO = sys.argv[2] if len(sys.argv) > 2 else 'seguridad-local-0123456789abcdefghijklmnopqrstuvwxyz-ABCDEFG'
host = urllib.parse.urlparse(BASE).hostname
if host not in ('localhost', '127.0.0.1'):
    sys.exit(f'Abortado: {BASE} no es local. Estas pruebas solo se corren contra localhost.')
API = BASE + '/api/v1'
CLAVE = 'Demo1234!'
resultados = []
cuerpos_vistos = []


def r(nombre, ok, detalle=''):
    resultados.append(('OK   ' if ok is True else 'FALLA' if ok is False else 'INFO ') + f' {nombre}' + (f'  [{detalle}]' if detalle else ''))


def pedir(metodo, ruta, cuerpo=None, token=None, cab=None, crudo=None):
    url = ruta if ruta.startswith('http') else API + ruta
    datos = crudo if crudo is not None else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    req = urllib.request.Request(url, data=datos, method=metodo)
    if datos is not None:
        req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    for k, v in {'X-Device-Fingerprint': 'pruebas-seguridad-local', **(cab or {})}.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            texto = resp.read().decode('utf-8', 'replace')
            estado, cabeceras = resp.status, dict(resp.headers)
    except urllib.error.HTTPError as e:
        texto = e.read().decode('utf-8', 'replace')
        estado, cabeceras = e.code, dict(e.headers)
    cuerpos_vistos.append((f'{metodo} {ruta}', estado, texto))
    try:
        js = json.loads(texto) if texto else None
    except ValueError:
        js = None
    return estado, {k.lower(): v for k, v in cabeceras.items()}, js, texto


def login(email):
    e, _, js, _ = pedir('POST', '/auth/login', {'email': email, 'password': CLAVE})
    assert e in (200, 201), f'login {email}: {e}'
    return js['data']['access_token'], js['data']['user']


def b64(d):
    return base64.urlsafe_b64encode(d).rstrip(b'=').decode()


def firmar(payload, secreto=SECRETO, alg='HS256'):
    cab = b64(json.dumps({'alg': alg, 'typ': 'JWT'}).encode())
    cuerpo = b64(json.dumps(payload).encode())
    if alg == 'none':
        return f'{cab}.{cuerpo}.'
    firma = b64(hmac.new(secreto.encode(), f'{cab}.{cuerpo}'.encode(), hashlib.sha256).digest())
    return f'{cab}.{cuerpo}.{firma}'


def payload_de(token):
    p = token.split('.')[1]
    return json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)))


# ---------------- 4. Mensaje de login genérico (2 intentos) y espera para no mezclar con el límite ----------------
e1, _, js1, _ = pedir('POST', '/auth/login', {'email': 'sofia.ruiz@gmail.com', 'password': 'Incorrecta123'})
e2, _, js2, _ = pedir('POST', '/auth/login', {'email': 'no.existe@correo.com', 'password': 'Incorrecta123'})
r('4 login: mismo estado y mensaje con correo existente o inexistente', e1 == e2 == 401 and js1['detail'] == js2['detail'], f"{e1}/{e2} '{(js1 or {}).get('detail')}'")
time.sleep(61)

# ---------------- Sesiones (4 logins: dentro del límite de 5/min) ----------------
t_sofia, u_sofia = login('sofia.ruiz@gmail.com')        # huésped
t_mateo, u_mateo = login('mateo.cevallos@hotmail.com')  # otro huésped (víctima del IDOR)
t_ana, u_ana = login('ana.paredes@gmail.com')           # "anfitrión": USUARIO dueño de alojamientos demo
t_admin, u_admin = login('admin.plataforma@gmail.com')  # ADMIN
roles = {'anónimo': None, 'USUARIO': t_sofia, 'anfitrión (USUARIO)': t_ana, 'ADMIN': t_admin}

# ---------------- 1. Matriz endpoint x rol ----------------
MATRIZ = [  # (método, ruta, cuerpo, {rol: estado esperado})
    ('GET', '/me', None, {'anónimo': 401, 'USUARIO': 200, 'anfitrión (USUARIO)': 200, 'ADMIN': 200}),
    ('GET', '/me/orders', None, {'anónimo': 401, 'USUARIO': 200, 'anfitrión (USUARIO)': 200, 'ADMIN': 200}),
    ('GET', '/admin/indicators', None, {'anónimo': 401, 'USUARIO': 403, 'anfitrión (USUARIO)': 403, 'ADMIN': 200}),
    ('GET', '/admin/users', None, {'anónimo': 401, 'USUARIO': 403, 'anfitrión (USUARIO)': 403, 'ADMIN': 200}),
    ('GET', '/admin/events', None, {'anónimo': 401, 'USUARIO': 403, 'anfitrión (USUARIO)': 403, 'ADMIN': 200}),
    ('GET', '/host/accommodations', None, {'anónimo': 401, 'USUARIO': 403, 'anfitrión (USUARIO)': 403, 'ADMIN': 200}),
    ('GET', '/host/orders', None, {'anónimo': 401, 'USUARIO': 403, 'anfitrión (USUARIO)': 403, 'ADMIN': 200}),
    ('PATCH', '/host/accommodations/1001', {'nombre': 'Hackeado'}, {'anónimo': 401, 'USUARIO': 403, 'anfitrión (USUARIO)': 403}),
    ('POST', '/admin/jobs/purgar-idempotencia/ejecutar', {}, {'anónimo': 401, 'USUARIO': 403, 'anfitrión (USUARIO)': 403}),
    ('POST', '/search', {'checkin': str(date.today() + timedelta(days=20)), 'checkout': str(date.today() + timedelta(days=22)),
                         'guests': {'number_of_adults': 2, 'number_of_rooms': 1}, 'booker': {'country': 'ec', 'platform': 'desktop'}, 'currency': 'USD'},
     {'anónimo': 200, 'USUARIO': 200, 'ADMIN': 200}),
]
for metodo, ruta, cuerpo, esperados in MATRIZ:
    obtenidos = {}
    for rol, esperado in esperados.items():
        e, *_ = pedir(metodo, ruta, cuerpo, roles[rol])
        obtenidos[rol] = e
    r(f'1 matriz {metodo} {ruta}', all(obtenidos[k] == v for k, v in esperados.items()), ' '.join(f'{k}={v}' for k, v in obtenidos.items()))

# IDOR: Sofía contra la reserva de Mateo
_, _, js, _ = pedir('GET', '/me/orders?limit=50&offset=0', token=t_mateo)
orden_mateo = next(o for o in js['data']['items'] if o['estado_interno'] == 'CONFIRMADA')
oid = orden_mateo['order_id']
IDOR = [('GET', f'/orders/{oid}', None), ('GET', f'/orders/{oid}/invoice', None), ('GET', f'/orders/{oid}/timeline', None),
        ('GET', f'/orders/{oid}/cancel-preview', None),
        ('POST', f'/orders/{oid}/modify', {'checkout': str(date.fromisoformat(orden_mateo['accommodation_details']['checkout']) + timedelta(days=1))}),
        ('POST', f'/orders/{oid}/cancel', None), ('POST', f'/orders/{oid}/review', {'nota_global': 2})]
for metodo, ruta, cuerpo in IDOR:
    e, _, js, _ = pedir(metodo, ruta, cuerpo, t_sofia, {'Idempotency-Key': str(uuid.uuid4())})
    r(f'1 IDOR {metodo} {ruta.replace(oid, "{orden de otro}")}', e in (403, 404), f'estado={e}')
e, _, js, _ = pedir('GET', f'/orders/{oid}', token=t_mateo)
r('1 IDOR la reserva de la víctima sigue intacta', e == 200 and js['status'] == 'CONFIRMED', f"estado={js.get('status') if js else e}")

# ---------------- 2. JWT ----------------
p = payload_de(t_sofia)
casos = {
    'sin token': None,
    'token basura': 'abc.def.ghi',
    'payload manipulado (rol ADMIN, misma firma)': '.'.join([t_sofia.split('.')[0], b64(json.dumps({**p, 'rol': 'ADMIN'}).encode()), t_sofia.split('.')[2]]),
    'expirado (firma válida)': firmar({**p, 'iat': int(time.time()) - 7200, 'exp': int(time.time()) - 3600}),
    'firmado con otro secreto': firmar({**p, 'rol': 'ADMIN'}, 'otro-secreto-' + 'x' * 40),
    'alg none': firmar({**p, 'rol': 'ADMIN'}, alg='none'),
}
for nombre, tok in casos.items():
    e, _, js, _ = pedir('GET', '/me', token=tok)
    r(f'2 JWT {nombre} -> 401', e == 401, f'estado={e}')
e, *_ = pedir('GET', '/admin/indicators', token=t_sofia)
r('2 JWT token de USUARIO en ruta admin -> 403', e == 403, f'estado={e}')
e, *_ = pedir('GET', '/admin/indicators', token=firmar({**p, 'rol': 'ADMIN', 'scope': p.get('scope', '')}))
r('2 JWT (control) rol ADMIN firmado con el secreto real sí entra', e == 200, f'estado={e}: el rol vale porque solo el servidor conoce el secreto')

# ---------------- 3. Mass assignment ----------------
e, _, js, _ = pedir('PATCH', '/me', {'nombres': 'Sofía', 'rol': 'ADMIN'}, t_sofia)
r('3 PATCH /me con rol -> 400', e == 400, f"estado={e} {(js or {}).get('invalidParams')}")
for campo, valor in [('email', 'otra@correo.com'), ('estado', 'ACTIVO'), ('usuarioId', u_admin['id']), ('activo', False), ('es_anfitrion', True)]:
    e, *_ = pedir('PATCH', '/me', {campo: valor}, t_sofia)
    r(f'3 PATCH /me con {campo} -> 400', e == 400, f'estado={e}')
_, _, js, _ = pedir('GET', '/me', token=t_sofia)
r('3 el perfil sigue siendo USUARIO', js['data']['rol'] == 'USUARIO', js['data']['rol'])

# ---------------- 6. Inyección ----------------
fut1, fut2 = str(date.today() + timedelta(days=30)), str(date.today() + timedelta(days=32))
base_busq = {'checkin': fut1, 'checkout': fut2, 'guests': {'number_of_adults': 2, 'number_of_rooms': 1}, 'booker': {'country': 'ec', 'platform': 'desktop'}, 'currency': 'USD'}
for nombre, extra in [('sort_by', {'sort_by': "precio_asc; DROP TABLE booking.usuario;--"}), ('province', {'province': "' OR '1'='1"}),
                      ('city', {'city': '1 OR 1=1'}), ('max_price', {'max_price': '0 OR 1=1'})]:
    e, _, js, _ = pedir('POST', '/search', {**base_busq, **extra})
    r(f'6 SQLi en búsqueda ({nombre}) -> 400 sin 500', e == 400, f'estado={e}')
e1, _, js1, _ = pedir('GET', '/admin/users?q=' + urllib.parse.quote("' OR '1'='1"), token=t_admin)
r('6 SQLi en filtro admin (q) -> sin coincidencias, sin error', e1 == 200 and js1['data']['total'] == 0, f"estado={e1} total={(js1 or {}).get('data', {}).get('total')}")
e2, _, js2, _ = pedir('GET', '/admin/accommodations?busqueda=' + urllib.parse.quote("%' OR 1=1--"), token=t_admin)
r('6 SQLi en filtro admin (busqueda) -> sin coincidencias, sin error', e2 in (200, 400) and (e2 == 400 or js2['data']['total'] == 0), f'estado={e2}')
e, _, js, _ = pedir('GET', '/me', token=t_sofia)
r('6 las tablas siguen intactas tras los intentos', e == 200)

e, _, js, _ = pedir('PATCH', '/me', {'nombres': '<script>alert(1)</script>'}, t_sofia)
r('6 XSS en nombre -> 400 (solo letras)', e == 400, f'estado={e}')
_lista = pedir('GET', '/host/accommodations', token=t_admin)[2]['data']
codigo = (_lista['items'] if isinstance(_lista, dict) else _lista)[0]['codigo']
desc_xss = 'Descripción de prueba <img src=x onerror=alert(1)> <script>alert(2)</script> con texto suficiente para validar.'
e, *_ = pedir('PATCH', f'/host/accommodations/{codigo}', {'descripcion': desc_xss}, t_admin)
_, _, js, _ = pedir('GET', f'/host/accommodations/{codigo}', token=t_admin)
guardada = js['data']['descripcion'] if js and 'data' in js else ''
r('6 XSS en descripción se guarda sin etiquetas', e == 200 and '<' not in guardada and 'onerror' not in guardada.lower() or '<' not in guardada, f'guardada="{guardada[:60]}…"')
for url in ['javascript:alert(1)', 'http://inseguro.com/a.jpg', 'data:image/png;base64,AAAA']:
    e, *_ = pedir('PATCH', f'/host/accommodations/{codigo}', {'imagenes': [{'url': url, 'es_portada': True}]}, t_admin)
    r(f'6 URL de imagen no https ({url.split(":")[0]}) -> 400', e == 400, f'estado={e}')

# ---------------- 7. Fugas de errores ----------------
e, h, js, txt = pedir('POST', '/search', crudo=b'{"checkin": "2026-1')
r('7 JSON mal formado -> 400 ProblemDetails', e == 400 and 'problem+json' in h.get('content-type', ''), f"estado={e} {h.get('content-type')}")
e, h, js, txt = pedir('GET', '/orders/no-es-uuid', token=t_sofia)
r('7 id no UUID -> 400', e == 400, f'estado={e}')
e, h, js, txt = pedir('GET', '/no-existe', token=t_sofia)
r('7 ruta inexistente -> 404 ProblemDetails', e == 404 and 'problem+json' in h.get('content-type', ''), f'estado={e}')
e, h, js, txt = pedir('POST', '/search', crudo=json.dumps({**base_busq, 'relleno': 'x' * 120_000}).encode())
r('7 cuerpo > 100 kB -> 413', e == 413, f'estado={e}')
e, h, js, txt = pedir('POST', '/search', {**base_busq, 'city': 99999999999})
r('7 entero enorme en filtro -> 4xx (no 500)', 400 <= e < 500, f'estado={e}')

# ---------------- 8. Fechas e idempotencia ----------------
unidad = pedir('GET', f'/host/accommodations/{codigo}/units', token=t_admin)[2]['data'][0]['id']
pasado = b64(f'{unidad}|1998-11-12|1998-11-14'.encode())
e, _, js, _ = pedir('POST', '/orders/preview', {'accommodation_id': codigo, 'product_id': pasado, 'guests': {'number_of_adults': 1, 'number_of_rooms': 1}}, t_sofia)
r('8 preview con entrada 1998-11-12 -> 400', e == 400 and 'pasado' in json.dumps(js, ensure_ascii=False), f'estado={e}')
_, _, js, _ = pedir('POST', '/search', base_busq)
reservado = False
for item in js['data']:
    cod = item['id']
    ea, _, jsa, _ = pedir('POST', '/availability', {'accommodation': cod, 'checkin': fut1, 'checkout': fut2, 'booker': {'country': 'ec', 'platform': 'desktop'},
                                                     'guests': {'number_of_adults': 1, 'number_of_rooms': 1}, 'currency': 'USD'})
    productos = (jsa or {}).get('data', {}).get('products', [])
    if not productos:
        continue
    ep, _, jsp, _ = pedir('POST', '/orders/preview', {'accommodation_id': cod, 'product_id': productos[0]['id'],
                                                      'guests': {'number_of_adults': 1, 'number_of_rooms': 1}}, t_sofia)
    if ep not in (200, 201):
        continue
    prev = jsp['data']['order_preview_id']
    pedido = {'order_preview_id': prev, 'payment_reference': 'PAY-SEGUR1DAD', 'customer_details': {'document_type': 'CONSUMIDOR_FINAL'}}
    e0, *_ = pedir('POST', '/orders/create', pedido, t_sofia)
    r('8 crear orden sin Idempotency-Key -> 400', e0 == 400, f'estado={e0}')
    clave = str(uuid.uuid4())
    e1, h1, js1, _ = pedir('POST', '/orders/create', pedido, t_sofia, {'Idempotency-Key': clave})
    e2, h2, js2, _ = pedir('POST', '/orders/create', pedido, t_sofia, {'Idempotency-Key': clave})
    misma = js1 and js2 and js1.get('order_id') == js2.get('order_id')
    r('8 misma Idempotency-Key -> misma orden, respuesta reproducida', e1 in (200, 201) and e2 == e1 and misma and h2.get('idempotent-replayed') == 'true',
      f"{e1}/{e2} replayed={h2.get('idempotent-replayed')}")
    e3, *_ = pedir('POST', '/orders/create', {**pedido, 'payment_reference': 'PAY-OTROCUERPO'}, t_sofia, {'Idempotency-Key': clave})
    r('8 misma clave con otro cuerpo -> 409', e3 == 409, f'estado={e3}')
    # Reenvío del mismo preview con OTRA clave y otros datos de factura: misma orden y factura intacta
    otro = {**pedido, 'customer_details': {'document_type': 'CEDULA', 'document_number': '1710034065', 'first_name': 'Otra',
                                           'last_name': 'Persona', 'email': 'otra.persona@correo.com'}}
    e4, _, js4, _ = pedir('POST', '/orders/create', otro, t_sofia, {'Idempotency-Key': str(uuid.uuid4())})
    _, _, fac, _ = pedir('GET', f"/orders/{js1['order_id']}/invoice", token=t_sofia)
    r('8 otra clave con el mismo preview -> la misma orden (sin doble cobro)', e4 in (200, 201) and js4.get('order_id') == js1['order_id'], f'estado={e4}')
    r('8 ese reenvío no reescribe el comprador de la factura ya emitida', fac['data']['comprador_identificacion'] != '1710034065',
      f"comprador={fac['data']['comprador_nombre']} / {fac['data']['comprador_identificacion']}")
    with open('ultima_orden_seguridad.txt', 'w') as f:
        f.write(js1['order_id'])
    _, _, js5, _ = pedir('POST', f"/orders/{js1['order_id']}/modify", {'checkin': '1998-11-12'}, t_sofia, {'Idempotency-Key': str(uuid.uuid4())})
    r('8 modify con entrada en el pasado -> 400', js5 and js5.get('status') == 400, f"estado={(js5 or {}).get('status')}")
    reservado = True
    break
if not reservado:
    r('8 idempotencia: no se encontró disponibilidad para probar', None)

# ---------------- 5. Cabeceras, CORS, Swagger y /health ----------------
e, h, js, txt = pedir('GET', BASE + '/health')
r('5 /health solo expone estado', e == 200 and set(js) <= {'status', 'app', 'db', 'timestamp'}, str(sorted(js)))
for cab, esperado in [('content-security-policy', "default-src 'self'"), ('x-content-type-options', 'nosniff'), ('x-frame-options', 'SAMEORIGIN'),
                      ('referrer-policy', 'no-referrer'), ('cross-origin-resource-policy', 'same-site')]:
    r(f'5 cabecera {cab}', esperado in h.get(cab, ''), h.get(cab, '(falta)')[:60])
r('5 sin X-Powered-By', 'x-powered-by' not in h, h.get('x-powered-by', 'ausente'))
r('5 HSTS solo en producción (aquí APP_ENV=development)', 'strict-transport-security' not in h, h.get('strict-transport-security', 'ausente'))
e, h, *_ = pedir('OPTIONS', '/search', cab={'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST'})
r('5 CORS: origen no permitido sin Access-Control-Allow-Origin', 'access-control-allow-origin' not in h, h.get('access-control-allow-origin', 'ausente'))
e, h, *_ = pedir('OPTIONS', '/search', cab={'Origin': 'http://localhost:4200', 'Access-Control-Request-Method': 'POST'})
r('5 CORS: origen permitido sí', h.get('access-control-allow-origin') == 'http://localhost:4200', h.get('access-control-allow-origin', 'ausente'))
e, h, js, txt = pedir('GET', BASE + '/api/docs-json')
sensibles = [s for s in ['DATABASE_URL', 'JWT_SECRET', 'password_hash', 'supabase', 'postgresql://', SECRETO] if s.lower() in txt.lower()]
r('5 Swagger sin secretos ni datos internos', e == 200 and not sensibles, f'estado={e} encontrados={sensibles}')

# ---------------- 4. Login genérico y fuerza bruta (al final: consume el límite) ----------------
estados = [pedir('POST', '/auth/login', {'email': 'sofia.ruiz@gmail.com', 'password': f'Mala{i}xyz'})[0] for i in range(4)]
e429, h429, js429, _ = pedir('POST', '/auth/login', {'email': 'sofia.ruiz@gmail.com', 'password': 'MalaFinal1'})
r('4 fuerza bruta en login -> 429 con Retry-After', e429 == 429 and 'retry-after' in h429, f'intentos={estados + [e429]} retry-after={h429.get("retry-after")}')
e_spoof, *_ = pedir('POST', '/auth/login', {'email': 'sofia.ruiz@gmail.com', 'password': 'MalaSpoof1'}, cab={'X-Forwarded-For': '203.0.113.77'})
r('4 límite con X-Forwarded-For falsificado (acceso directo sin proxy)', None if e_spoof == 401 else True,
  f'estado={e_spoof}: con "trust proxy 1" y acceso DIRECTO la IP se toma de X-Forwarded-For; detrás del proxy de Render no aplica')
estados_reg = [pedir('POST', '/auth/register', {'email': f'spam{i}.{uuid.uuid4().hex[:6]}@correo.com', 'password': 'Clave1234',
                                                 'nombres': 'Spam', 'apellidos': 'Prueba', **({'rol': 'ADMIN'} if i == 0 else {})})[0] for i in range(7)]
r('3 registro con campo rol -> 400', estados_reg[0] == 400, f'estado={estados_reg[0]}')
r('4 fuerza bruta en registro -> 429', 429 in estados_reg, f'estados={estados_reg}')

# ---------------- 7. Ninguna respuesta filtra stack, rutas ni SQL ----------------
patrones = ['    at ', 'node_modules', '.ts:', 'C:\\', '/src/', 'SELECT ', 'INSERT INTO', 'syntax error', 'QueryFailedError', 'stack']
fugas = [(q, e) for q, e, t in cuerpos_vistos if e >= 400 and any(pt in t for pt in patrones)]
r(f'7 ninguna de las {sum(1 for _, e, _ in cuerpos_vistos if e >= 400)} respuestas de error filtra stack/rutas/SQL', not fugas, str(fugas[:3]))
cinco = [(q, e) for q, e, _ in cuerpos_vistos if e >= 500]
r('7 ningún 500 en toda la batería', not cinco, str(cinco[:3]))

print('\n'.join(resultados))
print(f"\nTotal: {sum(1 for x in resultados if x.startswith('OK'))} OK · {sum(1 for x in resultados if x.startswith('FALLA'))} FALLA · "
      f"{sum(1 for x in resultados if x.startswith('INFO'))} INFO")
