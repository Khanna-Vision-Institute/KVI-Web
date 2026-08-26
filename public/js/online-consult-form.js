document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('onlineConsultForm');
  if (!form) {
    return;
  }

  const feedback = document.getElementById('consultFeedback');

  function setFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove('success', 'error');
    if (type) {
      feedback.classList.add(type);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = {
      consultDate: form.elements['consultDate'].value.trim(),
      firstName: form.elements['firstName'].value.trim(),
      lastName: form.elements['lastName'].value.trim(),
      dob: form.elements['dob'].value.trim(),
      age: form.elements['age'].value.trim(),
      address1: form.elements['address1'].value.trim(),
      address2: form.elements['address2'].value.trim(),
      city: form.elements['city'].value.trim(),
      zip: form.elements['zip'].value.trim(),
      phone: form.elements['phone'].value.trim(),
      email: form.elements['email'].value.trim(),
      reason: form.elements['reason'].value.trim(),
      referralSources: Array.from(form.querySelectorAll('input[name="referralSources"]:checked')).map((el) => el.value)
    };

    if (!data.firstName || !data.lastName || !data.email || !data.phone) {
      setFeedback('First name, last name, email, and phone are required.', 'error');
      return;
    }

    setFeedback('Saving your consultation request...', null);

    try {
      const response = await fetch('/api/booking/online-consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to save your request right now.');
      }

      setFeedback('✓ Consultation request received! We will contact you shortly.', 'success');
      form.reset();
    } catch (error) {
      console.error('Online consult submission failed:', error);
      setFeedback(error.message || 'Something went wrong. Please try again.', 'error');
    }
  });
});
