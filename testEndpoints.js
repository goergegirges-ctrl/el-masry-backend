const testAuth = async () => {
    try {
        console.log("3. Testing POST /api/users/login");
        const res = await fetch('http://localhost:4000/api/users/login', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: 'invalid@example.com', password: '123' }) 
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(data)}`);
    } catch(err) {
        console.log("Error:", err.message);
    }
}

const testReview = async (productId) => {
    try {
        console.log(`5. Testing GET /api/reviews/${productId}`);
        const res = await fetch(`http://localhost:4000/api/reviews/${productId}`);
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Data count: ${data.data ? data.data.length : 'N/A'}`);
    } catch(err) {
        console.log("Error:", err.message);
    }
}

const runTests = async () => {
    console.log("Starting tests...\n");

    try {
        console.log("1. Testing GET /api/product/active");
        const res1 = await fetch('http://localhost:4000/api/product/active');
        const data1 = await res1.json();
        console.log(`Status: ${res1.status}`);
        console.log(`Data count: ${data1.data ? data1.data.length : 'N/A'}`);
        if(data1.data && data1.data.length > 0) {
            console.log(`Sample: ${JSON.stringify(data1.data[0], null, 2)}`);
            await testReview(data1.data[0].id); // test review with valid product ID
        }
    } catch (e) {
        console.log("Error 1:", e.message);
    }

    console.log("\n--------------------\n");

    try {
        console.log("2. Testing GET /api/product/list");
        const res2 = await fetch('http://localhost:4000/api/product/list');
        const data2 = await res2.json();
        console.log(`Status: ${res2.status}`);
        console.log(`Data count: ${data2.data ? data2.data.length : 'N/A'}`);
    } catch (e) {
        console.log("Error 2:", e.message);
    }

    console.log("\n--------------------\n");

    await testAuth();

    console.log("\n--------------------\n");

    try {
        console.log("4. Testing GET /api/order/list");
        const res4 = await fetch('http://localhost:4000/api/order/list');
        const data4 = await res4.json();
        console.log(`Status: ${res4.status}`);
        console.log(`Data count: ${data4.data ? data4.data.length : 'N/A'}`);
    } catch (e) {
        console.log("Error 4:", e.message);
    }

}

runTests();
