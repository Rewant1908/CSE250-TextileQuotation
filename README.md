# Textile Quotation System (CSE250-DBMS)

---
## 1. Project Overview

The **Textile Quotation System** is a simple web-based application developed as part of the **CSE250 – Database Management Systems** course.  
The project aims to automate the process of generating quotations for textile import and export operations.

This system allows users to manage textile products, enter order details, and generate accurate price quotations based on predefined rates and quantities.  
By replacing manual quotation methods, the application helps reduce errors, improve efficiency, and maintain consistent pricing records.

The project demonstrates the practical use of database concepts such as data storage, retrieval, and structured querying in a real-world business scenario.

## 2. Features

- **Product Management**  
  Allows storage and management of textile product details such as name, type, and base price.

- **Quotation Generation**  
  Generates quotations based on selected products, quantities, and predefined pricing rules.

- **Database Integration**  
  Uses a relational database to store product information, quotations, and customer details.

- **Data Retrieval and Queries**  
  Implements SQL queries to fetch, insert, and update quotation-related data efficiently.

- **User-Friendly Interface**  
  Provides a simple and intuitive web interface for entering order details and viewing quotations.

- **Error Reduction and Consistency**  
  Reduces manual calculation errors and ensures consistent quotation results.

## 3. Technology Used

- **Database**: MariaDB
- **Backend**: NodeJS with Express
- **Frontend**: (HTML, CSS, JavaScript)
- **Language**: SQL and JavaScript
- **Environment**: Linux(WSL),
- **Development Tool:** IntelliJ IDEA
- **Version Control:** GitHub

## 4. Database Design

The database consists of the following main entities:

- **Customer**: Stores customer details such as name and contact information.
- **Product**: Stores textile product details including product name, type, and price.
- **Quotation**: Represents a quotation generated for a customer.
- **Quotation-Item**: A junction table to model the many-to-many relationship between quotations and products.
