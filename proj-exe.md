# this is the project execution plan:

1. installed wsl on windows : wsl --install
2. installed IntellijIdea
3. created a repo on GitHub and cloned it on IntellijIdea
4. installed mariadb on wsl
5. Start MariaDB (INSIDE WSL): sudo service mariadb start
6. Login to MariaDB : sudo mariadb
7. Create database: CREATE DATABASE cse250; 
8. Create a user: CREATE USER 'vijay'@'%' IDENTIFIED BY 'password';
9. Give permissions: GRANT ALL PRIVILEGES ON cse250.* TO 'vijay'@'%';
   FLUSH PRIVILEGES;
10. 


