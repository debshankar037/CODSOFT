function validateForm() {
    const adults = parseInt(document.getElementById('adults').value);
    const children = parseInt(document.getElementById('children').value);
    const maxPrice = parseInt(document.getElementById('maxPrice').value);
    const travelClass=document.getElementById('travelClass').value;
    
    if (adults < 1 || children < 0 || maxPrice < 50) {
        alert('Please enter correct values for Adults, Children, and Max Price.');
        return false; // Prevent form submission
    }
    if(!(/^[A-Z]+$/.test(str))){
        alert("please ensure that you write the travel class in capital letters");
        return false;
    }
    return true; // Allow form submission
}
const flightButton = document.getElementById("flightButton");
    const hotelButton = document.getElementById("hotelButton");
    const carButton = document.getElementById("carButton");

    flightButton.addEventListener('click', function() {
        window.location.href = '/';
    });

    hotelButton.addEventListener('click', function() {
        window.location.href = '/hotel-input'; // Adjust the route accordingly
    });

    carButton.addEventListener('click', function() {
        window.location.href = '/blog'; // Adjust the route accordingly
    });
    const flightButton2 = document.getElementById("flightButton2");
    console.log(flightButton2)
    const hotelButton2 = document.getElementById("hotelButton2");
    const carButton2 = document.getElementById("carButton2");
    
    flightButton2.addEventListener('click', function() {
        window.location.href = '/';
    });

    hotelButton2.addEventListener('click', function() {
        window.location.href = '/hotel-input'; // Adjust the route accordingly
    });

    carButton2.addEventListener('click', function() {
        window.location.href = '/blog'; // Adjust the route accordingly
    });

    