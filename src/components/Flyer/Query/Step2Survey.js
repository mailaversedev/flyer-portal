import React, { useState } from 'react';
import { Plus, ChevronDown, X } from 'lucide-react';
import './Step2Survey.css';

const Step2Survey = ({ data, onUpdate }) => {
  const [questions, setQuestions] = useState(data.questions || [
    {
      id: 1,
      type: '',
      question: '',
      answers: ['']
    }
  ]);

  const [selectedQuestion, setSelectedQuestion] = useState(1);

  const addNewQuestion = () => {
    const newQuestion = {
      id: questions.length + 1,
      type: '',
      question: '',
      answers: ['']
    };
    const updatedQuestions = [...questions, newQuestion];
    setQuestions(updatedQuestions);
    setSelectedQuestion(newQuestion.id);
    onUpdate({ questions: updatedQuestions });
  };

  const updateQuestion = (questionId, field, value) => {
    const updatedQuestions = questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    );
    setQuestions(updatedQuestions);
    onUpdate({ questions: updatedQuestions });
  };

  const updateAnswer = (questionId, answerIndex, value) => {
    const updatedQuestions = questions.map(q => {
      if (q.id === questionId) {
        const newAnswers = [...q.answers];
        newAnswers[answerIndex] = value;
        return { ...q, answers: newAnswers };
      }
      return q;
    });
    setQuestions(updatedQuestions);
    onUpdate({ questions: updatedQuestions });
  };

  const addNewAnswer = (questionId) => {
    const updatedQuestions = questions.map(q => {
      if (q.id === questionId) {
        return { ...q, answers: [...q.answers, ''] };
      }
      return q;
    });
    setQuestions(updatedQuestions);
    onUpdate({ questions: updatedQuestions });
  };

  const removeQuestion = (questionId) => {
    if (questions.length <= 1) {
      // Don't allow removing the last question
      return;
    }
    
    const updatedQuestions = questions.filter(q => q.id !== questionId);
    // Reassign IDs to maintain sequential numbering
    const reindexedQuestions = updatedQuestions.map((q, index) => ({
      ...q,
      id: index + 1
    }));
    
    setQuestions(reindexedQuestions);
    onUpdate({ questions: reindexedQuestions });
    
    // If the removed question was selected, select the first question
    if (selectedQuestion === questionId) {
      setSelectedQuestion(1);
    } else if (selectedQuestion > questionId) {
      // Adjust selected question ID if it was after the removed question
      setSelectedQuestion(selectedQuestion - 1);
    }
  };

  const removeAnswer = (questionId, answerIndex) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.answers.length <= 1) {
      // Don't allow removing the last answer for choice questions
      return;
    }
    
    const updatedQuestions = questions.map(q => {
      if (q.id === questionId) {
        return { 
          ...q, 
          answers: q.answers.filter((_, index) => index !== answerIndex)
        };
      }
      return q;
    });
    setQuestions(updatedQuestions);
    onUpdate({ questions: updatedQuestions });
  };

  // Validation functions
  const validateQuestion = (question) => {
    const errors = [];
    
    // Question text is mandatory
    if (!question.question || question.question.trim() === '') {
      errors.push('Question text is mandatory');
    }
    
    // At least one answer is required for multiple choice and single choice
    if ((question.type === 'multiple-choice' || question.type === 'single-choice')) {
      const validAnswers = question.answers.filter(answer => answer && answer.trim() !== '');
      if (validAnswers.length === 0) {
        errors.push('At least one answer is required for choice questions');
      }
    }
    
    return errors;
  };

  const getQuestionValidationStatus = (question) => {
    const errors = validateQuestion(question);
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const currentQuestion = questions.find(q => q.id === selectedQuestion) || questions[0];
  const currentValidation = getQuestionValidationStatus(currentQuestion);

  return (
    <div className="step2-survey">
      <div className="questions-layout">
        {/* Left Side - Question Configuration */}
        <div className="questions-form">
          <div className="questions-sidebar">
            <h3 className="sidebar-title">List of Questions</h3>
            <div className="questions-list">
              {questions.map((question) => {
                const validation = getQuestionValidationStatus(question);
                return (
                  <div key={question.id} className="question-item-container">
                    <button
                      className={`question-item ${selectedQuestion === question.id ? 'active' : ''} ${!validation.isValid ? 'invalid' : ''}`}
                      onClick={() => setSelectedQuestion(question.id)}
                    >
                      Question {question.id}
                      {!validation.isValid && <span className="validation-indicator">!</span>}
                    </button>
                    {questions.length > 1 && (
                      <button
                        className="remove-question-btn"
                        onClick={() => removeQuestion(question.id)}
                        title="Remove question"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button className="add-question-btn" onClick={addNewQuestion}>
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="question-editor">
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">Type of Question</label>
                <div className="select-wrapper">
                  <select 
                    className="form-select"
                    value={currentQuestion.type}
                    onChange={(e) => updateQuestion(currentQuestion.id, 'type', e.target.value)}
                  >
                    <option value="">Please select</option>
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="single-choice">Single Choice</option>
                    <option value="text-input">Text Input</option>
                    <option value="rating">Rating</option>
                  </select>
                  <ChevronDown className="select-icon" size={16} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Question</label>
                <textarea
                  className="form-textarea"
                  placeholder="Please enter"
                  rows={3}
                  value={currentQuestion.question}
                  onChange={(e) => updateQuestion(currentQuestion.id, 'question', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {currentQuestion.type === 'rating' ? 'Rating Scale' : 'Answer'}
                </label>
                {currentQuestion.type === 'rating' ? (
                  <div className="rating-config">
                    <div className="rating-option">
                      <label className="radio-label">
                        <input 
                          type="radio" 
                          name={`rating-${currentQuestion.id}`}
                          value="5"
                          checked={currentQuestion.ratingScale === '5' || !currentQuestion.ratingScale}
                          onChange={(e) => updateQuestion(currentQuestion.id, 'ratingScale', e.target.value)}
                        />
                        <span>1-5 Stars</span>
                      </label>
                    </div>
                    <div className="rating-option">
                      <label className="radio-label">
                        <input 
                          type="radio" 
                          name={`rating-${currentQuestion.id}`}
                          value="10"
                          checked={currentQuestion.ratingScale === '10'}
                          onChange={(e) => updateQuestion(currentQuestion.id, 'ratingScale', e.target.value)}
                        />
                        <span>1-10 Scale</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="answers-list">
                    {currentQuestion.type === 'text-input' ? (
                      <div className="text-input-config">
                        <textarea
                          className="form-textarea answer-input"
                          placeholder="Placeholder text for the answer (optional)"
                          rows={2}
                          value={currentQuestion.answers[0] || ''}
                          onChange={(e) => updateAnswer(currentQuestion.id, 0, e.target.value)}
                        />
                        <small className="input-hint">This will be shown as placeholder text to users</small>
                      </div>
                    ) : (
                      <>
                        {currentQuestion.answers.map((answer, index) => (
                          <div key={index} className="answer-input-container">
                            <textarea
                              className="form-textarea answer-input"
                              placeholder="Please enter"
                              rows={2}
                              value={answer}
                              onChange={(e) => updateAnswer(currentQuestion.id, index, e.target.value)}
                            />
                            {currentQuestion.answers.length > 1 && (
                              <button
                                className="remove-answer-btn"
                                onClick={() => removeAnswer(currentQuestion.id, index)}
                                title="Remove answer"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button 
                          className="add-answer-btn"
                          onClick={() => addNewAnswer(currentQuestion.id)}
                        >
                          + Add New Answer
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Validation Messages */}
              {!currentValidation.isValid && (
                <div className="validation-messages">
                  {currentValidation.errors.map((error, index) => (
                    <div key={index} className="validation-error">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Preview */}
        <div className="preview-panel">
          <div className="preview-container">
            <h3 className="preview-title">Preview</h3>
            <div className="preview-content">
              <div className="preview-question">
                <div className="question-number">
                  {selectedQuestion}. {currentQuestion.question || 'Where are you from?'}
                </div>
                <div className="preview-answers">
                  {currentQuestion.type === 'rating' ? (
                    <div className="rating-preview">
                      {currentQuestion.ratingScale === '10' ? (
                        <div className="number-rating">
                          {Array.from({ length: 10 }, (_, i) => (
                            <button key={i + 1} className="rating-number">
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="star-rating">
                          {Array.from({ length: 5 }, (_, i) => (
                            <span key={i} className="star">★</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : currentQuestion.type === 'text-input' ? (
                    <input 
                      type="text" 
                      className="form-input preview-input" 
                      placeholder={currentQuestion.answers[0] || "Enter your answer..."}
                      readOnly
                    />
                  ) : (
                    <div className="select-wrapper preview-select">
                      <select className="form-select">
                        <option>Select</option>
                        {currentQuestion.answers.filter(answer => answer.trim()).map((answer, index) => (
                          <option key={index}>{answer}</option>
                        ))}
                      </select>
                      <ChevronDown className="select-icon" size={16} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step2Survey;
