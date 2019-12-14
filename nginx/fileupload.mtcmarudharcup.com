server {
	listen 80;
	server_name fileupload.mtcmarudharcup.com;
	location / {
		proxy_pass http://127.0.0.1:1330;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}